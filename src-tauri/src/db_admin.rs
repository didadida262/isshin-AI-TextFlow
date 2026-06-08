use base64::Engine;
use crate::assets::{
    list_project_ids, remove_all_asset_image_files, remove_asset_image_files_for_projects,
};
use crate::db::{database_file_path, init_db, seed_default_admin};
use rusqlite::{Connection, Row, types::ValueRef};
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::path::Path;

const BACKUP_VERSION: u32 = 1;

const APP_TABLES: &[&str] = &[
    "users",
    "projects",
    "novel_source",
    "novel_chapters",
    "script_work_data",
    "scripts",
    "project_assets",
];

const CLEAR_TABLE_ORDER: &[&str] = &[
    "project_assets",
    "scripts",
    "script_work_data",
    "novel_chapters",
    "novel_source",
    "projects",
    "users",
];

const IMPORT_TABLE_ORDER: &[&str] = APP_TABLES;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableOverview {
    pub name: String,
    pub row_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseOverview {
    pub db_path: String,
    pub tables: Vec<TableOverview>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseImportResult {
    pub imported_tables: Vec<String>,
    pub total_rows: i64,
}

#[derive(Debug, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseBackup {
    version: u32,
    exported_at: i64,
    tables: HashMap<String, Vec<Value>>,
}

fn is_allowed_table(name: &str) -> bool {
    APP_TABLES.contains(&name)
}

fn timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn table_columns(conn: &Connection, table: &str) -> Result<Vec<String>, String> {
    if !is_allowed_table(table) {
        return Err(format!("不支持的数据表: {table}"));
    }

    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|e| e.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(columns)
}

fn value_ref_to_json(value: ValueRef<'_>) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(v) => Value::Number(v.into()),
        ValueRef::Real(v) => serde_json::Number::from_f64(v)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        ValueRef::Text(v) => Value::String(String::from_utf8_lossy(v).into_owned()),
        ValueRef::Blob(v) => Value::String(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            v,
        )),
    }
}

fn row_to_json(row: &Row<'_>, column_names: &[String]) -> rusqlite::Result<Value> {
    let mut map = Map::new();
    for (index, name) in column_names.iter().enumerate() {
        map.insert(name.clone(), value_ref_to_json(row.get_ref(index)?));
    }
    Ok(Value::Object(map))
}

fn json_to_sqlite(value: &Value) -> rusqlite::types::Value {
    match value {
        Value::Null => rusqlite::types::Value::Null,
        Value::Bool(v) => rusqlite::types::Value::Integer(i64::from(*v)),
        Value::Number(v) => {
            if let Some(int_value) = v.as_i64() {
                rusqlite::types::Value::Integer(int_value)
            } else if let Some(float_value) = v.as_f64() {
                rusqlite::types::Value::Real(float_value)
            } else {
                rusqlite::types::Value::Null
            }
        }
        Value::String(v) => rusqlite::types::Value::Text(v.clone()),
        Value::Array(_) | Value::Object(_) => {
            rusqlite::types::Value::Text(value.to_string())
        }
    }
}

fn export_table(conn: &Connection, table: &str) -> Result<Vec<Value>, String> {
    let column_names = table_columns(conn, table)?;
    if column_names.is_empty() {
        return Ok(Vec::new());
    }

    let sql = format!("SELECT * FROM {table}");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row_to_json(row, &column_names))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

fn cleanup_asset_files_before_clear(conn: &Connection, table: &str) -> Result<(), String> {
    match table {
        "project_assets" => remove_all_asset_image_files(),
        "projects" => {
            let project_ids = list_project_ids(conn)?;
            remove_asset_image_files_for_projects(&project_ids)
        }
        _ => Ok(()),
    }
}

fn cleanup_all_asset_files_before_clear() -> Result<(), String> {
    remove_all_asset_image_files()
}

fn clear_table(conn: &Connection, table: &str) -> Result<i64, String> {
    if !is_allowed_table(table) {
        return Err(format!("不支持的数据表: {table}"));
    }

    let deleted = conn
        .execute(&format!("DELETE FROM {table}"), [])
        .map_err(|e| e.to_string())?;

    Ok(deleted as i64)
}

fn insert_rows(conn: &Connection, table: &str, rows: &[Value]) -> Result<i64, String> {
    if rows.is_empty() {
        return Ok(0);
    }

    let schema_columns = table_columns(conn, table)?;
    let mut inserted = 0_i64;

    for row in rows {
        let object = row
            .as_object()
            .ok_or_else(|| format!("表 {table} 存在无效行数据"))?;

        let columns: Vec<&String> = schema_columns
            .iter()
            .filter(|column| object.contains_key(*column))
            .collect();

        if columns.is_empty() {
            continue;
        }

        let placeholders = (1..=columns.len())
            .map(|index| format!("?{index}"))
            .collect::<Vec<_>>()
            .join(", ");
        let column_list = columns
            .iter()
            .map(|column| column.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!("INSERT INTO {table} ({column_list}) VALUES ({placeholders})");

        let values: Vec<rusqlite::types::Value> = columns
            .iter()
            .map(|column| json_to_sqlite(object.get(*column).unwrap_or(&Value::Null)))
            .collect();

        conn.execute(&sql, rusqlite::params_from_iter(values))
            .map_err(|e| format!("导入表 {table} 失败: {e}"))?;
        inserted += 1;
    }

    Ok(inserted)
}

#[tauri::command]
pub fn get_database_overview() -> Result<DatabaseOverview, String> {
    let conn = init_db()?;
    let db_path = database_file_path()?;
    let mut tables = Vec::new();

    for table in APP_TABLES {
        let row_count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        tables.push(TableOverview {
            name: (*table).to_string(),
            row_count,
        });
    }

    Ok(DatabaseOverview { db_path, tables })
}

#[tauri::command]
pub fn export_database() -> Result<String, String> {
    let conn = init_db()?;
    let mut tables = HashMap::new();

    for table in APP_TABLES {
        tables.insert((*table).to_string(), export_table(&conn, table)?);
    }

    let backup = DatabaseBackup {
        version: BACKUP_VERSION,
        exported_at: timestamp(),
        tables,
    };

    serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())
}

fn decode_base64_payload(base64: &str) -> Result<Vec<u8>, String> {
    let trimmed = base64.trim();
    let payload = trimmed
        .split_once("base64,")
        .map(|(_, data)| data)
        .unwrap_or(trimmed);
    base64::engine::general_purpose::STANDARD
        .decode(payload.trim())
        .map_err(|error| format!("Base64 解码失败: {error}"))
}

#[tauri::command]
pub fn copy_file(source: String, destination: String) -> Result<(), String> {
    let source = source.trim();
    let destination = destination.trim();
    if source.is_empty() {
        return Err("源文件路径不能为空".to_string());
    }
    if destination.is_empty() {
        return Err("请选择保存路径".to_string());
    }

    let source_path = Path::new(source);
    if !source_path.is_file() {
        return Err("源文件不存在".to_string());
    }

    if let Some(parent) = Path::new(destination).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|error| format!("创建目录失败: {error}"))?;
        }
    }

    std::fs::copy(source_path, destination).map_err(|error| format!("复制文件失败: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn write_base64_file(path: String, base64: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("请选择保存路径".to_string());
    }

    let bytes = decode_base64_payload(&base64)?;

    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|error| format!("创建目录失败: {error}"))?;
        }
    }

    std::fs::write(path, bytes).map_err(|error| format!("写入文件失败: {error}"))
}

#[tauri::command]
pub fn export_database_to_file(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("请选择导出路径".to_string());
    }

    let payload = export_database()?;

    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|error| format!("创建目录失败: {error}"))?;
        }
    }

    std::fs::write(path, payload).map_err(|error| format!("写入文件失败: {error}"))
}

#[tauri::command]
pub fn import_database(payload: String) -> Result<DatabaseImportResult, String> {
    let parsed: DatabaseBackup =
        serde_json::from_str(&payload).map_err(|e| format!("备份文件格式无效: {e}"))?;

    if parsed.version != BACKUP_VERSION {
        return Err(format!("不支持的备份版本: {}", parsed.version));
    }

    let conn = init_db()?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;

    tx.execute_batch("PRAGMA foreign_keys = OFF;")
        .map_err(|e| e.to_string())?;

    for table in CLEAR_TABLE_ORDER {
        clear_table(&tx, table)?;
    }

    let mut imported_tables = Vec::new();
    let mut total_rows = 0_i64;

    for table in IMPORT_TABLE_ORDER {
        let Some(rows) = parsed.tables.get(*table) else {
            continue;
        };
        let count = insert_rows(&tx, table, rows)?;
        if count > 0 {
            imported_tables.push((*table).to_string());
        }
        total_rows += count;
    }

    seed_default_admin(&tx)?;

    tx.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    Ok(DatabaseImportResult {
        imported_tables,
        total_rows,
    })
}

#[tauri::command]
pub fn clear_database_table(table_name: String) -> Result<i64, String> {
    let table = table_name.trim();
    if table.is_empty() {
        return Err("请选择要清空的数据表".to_string());
    }

    let conn = init_db()?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;
    tx.execute_batch("PRAGMA foreign_keys = OFF;")
        .map_err(|e| e.to_string())?;
    cleanup_asset_files_before_clear(&tx, table)?;
    let deleted = clear_table(&tx, table)?;
    if table == "users" {
        seed_default_admin(&tx)?;
    }
    tx.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[tauri::command]
pub fn clear_database() -> Result<i64, String> {
    let conn = init_db()?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;
    tx.execute_batch("PRAGMA foreign_keys = OFF;")
        .map_err(|e| e.to_string())?;

    cleanup_all_asset_files_before_clear()?;

    let mut deleted = 0_i64;
    for table in CLEAR_TABLE_ORDER {
        deleted += clear_table(&tx, table)?;
    }

    seed_default_admin(&tx)?;

    tx.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(deleted)
}
