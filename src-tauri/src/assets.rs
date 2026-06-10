use crate::db::init_db;
use crate::script::{self, SCRIPT_STATE_SUCCESS};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

pub const ASSET_STATE_SUCCESS: i32 = 1;
pub const ASSET_STATE_ERROR: i32 = 2;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAssetRecord {
    pub id: i64,
    pub project_id: String,
    pub name: String,
    pub asset_type: String,
    pub prompt: String,
    pub model: String,
    pub size: String,
    pub image_path: Option<String>,
    pub asset_state: i32,
    pub error_reason: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub generation_duration_ms: Option<i64>,
    pub num_inference_steps: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProjectAssetsResult {
    pub items: Vec<ProjectAssetRecord>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProjectAssetsInput {
    pub project_id: String,
    pub page: i32,
    pub page_size: i32,
    #[serde(default)]
    pub exclude_asset_types: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectAssetInput {
    pub project_id: String,
    pub name: String,
    pub asset_type: String,
    pub prompt: String,
    pub model: String,
    pub size: String,
    pub image_b64: Option<String>,
    pub video_b64: Option<String>,
    pub generation_duration_ms: Option<i64>,
    pub num_inference_steps: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectAssetInput {
    pub project_id: String,
    pub asset_id: i64,
    pub name: String,
    pub asset_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegenerateProjectAssetInput {
    pub project_id: String,
    pub asset_id: i64,
    pub name: String,
    pub asset_type: String,
    pub prompt: String,
    pub image_b64: String,
    pub generation_duration_ms: Option<i64>,
    pub num_inference_steps: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProjectAssetInput {
    pub project_id: String,
    pub asset_id: i64,
}

fn row_to_asset(row: &Row<'_>) -> rusqlite::Result<ProjectAssetRecord> {
    Ok(ProjectAssetRecord {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        asset_type: row.get(3)?,
        prompt: row.get(4)?,
        model: row.get(5)?,
        size: row.get(6)?,
        image_path: row.get(7)?,
        asset_state: row.get(8)?,
        error_reason: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        generation_duration_ms: row.get(12)?,
        num_inference_steps: row.get(13)?,
    })
}

const ASSET_SELECT: &str = "SELECT id, project_id, name, asset_type, prompt, model, size, image_path,
                asset_state, error_reason, created_at, updated_at, generation_duration_ms,
                num_inference_steps
         FROM project_assets";

fn timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn assets_root_dir() -> Result<PathBuf, String> {
    let dir = crate::paths::get()?.assets_dir.clone();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn project_assets_dir(project_id: &str) -> Result<PathBuf, String> {
    let dir = assets_root_dir()?.join(project_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn save_asset_image(project_id: &str, asset_id: i64, image_b64: &str) -> Result<String, String> {
    use base64::Engine;

    let cleaned = image_b64
        .trim()
        .trim_start_matches("data:image/png;base64,")
        .trim_start_matches("data:image/jpeg;base64,");
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(cleaned)
        .map_err(|error| format!("图片 Base64 解码失败: {error}"))?;

    let path = project_assets_dir(project_id)?.join(format!("{asset_id}.png"));
    fs::write(&path, bytes).map_err(|error| format!("保存图片失败: {error}"))?;
    Ok(path.to_string_lossy().into_owned())
}

fn save_asset_video(project_id: &str, asset_id: i64, video_b64: &str) -> Result<String, String> {
    use base64::Engine;

    let cleaned = video_b64
        .trim()
        .trim_start_matches("data:video/mp4;base64,");
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(cleaned)
        .map_err(|error| format!("视频 Base64 解码失败: {error}"))?;

    let path = project_assets_dir(project_id)?.join(format!("{asset_id}.mp4"));
    fs::write(&path, bytes).map_err(|error| format!("保存视频失败: {error}"))?;
    Ok(path.to_string_lossy().into_owned())
}

pub fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            asset_type TEXT NOT NULL DEFAULT 'scene',
            prompt TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT '',
            size TEXT NOT NULL DEFAULT '1024x1024',
            image_path TEXT,
            asset_state INTEGER NOT NULL DEFAULT 1,
            error_reason TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            generation_duration_ms INTEGER,
            num_inference_steps INTEGER,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    migrate_assets_schema(conn)?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_project_assets_project_created
         ON project_assets(project_id, created_at DESC)",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn migrate_assets_schema(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(project_assets)")
        .map_err(|e| e.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if !columns.iter().any(|name| name == "generation_duration_ms") {
        conn.execute(
            "ALTER TABLE project_assets ADD COLUMN generation_duration_ms INTEGER",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    if !columns.iter().any(|name| name == "num_inference_steps") {
        conn.execute(
            "ALTER TABLE project_assets ADD COLUMN num_inference_steps INTEGER",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn fetch_asset_by_id(
    conn: &Connection,
    project_id: &str,
    asset_id: i64,
) -> Result<ProjectAssetRecord, String> {
    conn.query_row(
        &format!("{ASSET_SELECT} WHERE project_id = ?1 AND id = ?2"),
        params![project_id, asset_id],
        row_to_asset,
    )
    .map_err(|e| e.to_string())
}

pub fn has_successful_assets(conn: &Connection, project_id: &str) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM project_assets WHERE project_id = ?1 AND asset_state = ?2",
            params![project_id, ASSET_STATE_SUCCESS],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

pub fn has_successful_non_video_assets(
    conn: &Connection,
    project_id: &str,
) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM project_assets
             WHERE project_id = ?1 AND asset_state = ?2 AND asset_type != 'video'",
            params![project_id, ASSET_STATE_SUCCESS],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

pub fn is_generate_video_completed(
    conn: &Connection,
    project_id: &str,
) -> Result<bool, String> {
    let scripts = script::fetch_scripts(conn, project_id)?;
    let generatable: Vec<_> = scripts
        .iter()
        .filter(|script| {
            script.script_state == SCRIPT_STATE_SUCCESS && !script.content.trim().is_empty()
        })
        .collect();

    if generatable.is_empty() {
        return Ok(false);
    }

    let videos = fetch_project_video_assets(conn, project_id)?;
    for script in generatable {
        let has_video = videos.iter().any(|video| {
            video.asset_state == ASSET_STATE_SUCCESS
                && video
                    .image_path
                    .as_ref()
                    .is_some_and(|path| !path.trim().is_empty())
                && video.name == script.name
        });
        if !has_video {
            return Ok(false);
        }
    }

    Ok(true)
}

fn sync_workflow_after_assets_change(
    conn: &Connection,
    project_id: &str,
) -> Result<(), String> {
    let current: String = conn
        .query_row(
            "SELECT current_workflow_node FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let now = timestamp();
    let has_assets = has_successful_non_video_assets(conn, project_id)?;
    let videos_complete = is_generate_video_completed(conn, project_id)?;

    if videos_complete
        && (current == "generateVideo" || current == "storyboard")
    {
        conn.execute(
            "UPDATE projects SET current_workflow_node = 'editExport', updated_at = ?2 WHERE id = ?1",
            params![project_id, now],
        )
        .map_err(|e| e.to_string())?;
        return Ok(());
    }

    if has_assets && (current == "generateAssets" || current == "storyboard") {
        conn.execute(
            "UPDATE projects SET current_workflow_node = 'generateVideo', updated_at = ?2 WHERE id = ?1",
            params![project_id, now],
        )
        .map_err(|e| e.to_string())?;
        return Ok(());
    }

    if !has_assets && (current == "generateVideo" || current == "storyboard") {
        conn.execute(
            "UPDATE projects SET current_workflow_node = 'generateAssets', updated_at = ?2 WHERE id = ?1",
            params![project_id, now],
        )
        .map_err(|e| e.to_string())?;
        return Ok(());
    }

    if !videos_complete && current == "editExport" {
        conn.execute(
            "UPDATE projects SET current_workflow_node = 'generateVideo', updated_at = ?2 WHERE id = ?1",
            params![project_id, now],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn fetch_project_video_assets(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<ProjectAssetRecord>, String> {
    let mut stmt = conn
        .prepare(
            &format!(
                "{ASSET_SELECT}
             WHERE project_id = ?1 AND asset_type = 'video'
             ORDER BY created_at DESC, id DESC"
            ),
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![project_id], row_to_asset)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(items)
}

fn exclude_asset_types_clause(exclude_asset_types: &[String]) -> String {
    exclude_asset_types
        .iter()
        .map(|asset_type| format!(" AND asset_type != '{}'", asset_type.replace('\'', "''")))
        .collect()
}

pub fn list_project_assets_internal(
    conn: &Connection,
    project_id: &str,
    page: i32,
    page_size: i32,
    exclude_asset_types: &[String],
) -> Result<ListProjectAssetsResult, String> {
    let page = page.max(1);
    let page_size = page_size.clamp(1, 100);
    let offset = ((page - 1) * page_size) as i64;
    let exclude_clause = exclude_asset_types_clause(exclude_asset_types);

    let count_sql = format!(
        "SELECT COUNT(*) FROM project_assets WHERE project_id = ?1{exclude_clause}"
    );
    let total: i64 = conn
        .query_row(&count_sql, params![project_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let list_sql = format!(
        "{ASSET_SELECT}
         WHERE project_id = ?1{exclude_clause}
         ORDER BY created_at DESC, id DESC
         LIMIT ?2 OFFSET ?3"
    );
    let mut stmt = conn.prepare(&list_sql).map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![project_id, page_size, offset], row_to_asset)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ListProjectAssetsResult {
        items,
        total,
        page,
        page_size,
    })
}

#[tauri::command]
pub fn list_project_assets(input: ListProjectAssetsInput) -> Result<ListProjectAssetsResult, String> {
    let conn = init_db()?;
    list_project_assets_internal(
        &conn,
        &input.project_id,
        input.page,
        input.page_size,
        &input.exclude_asset_types,
    )
}

#[tauri::command]
pub fn create_project_asset(input: CreateProjectAssetInput) -> Result<ProjectAssetRecord, String> {
    let conn = init_db()?;
    let now = timestamp();
    let name = input.name.trim();
    let prompt = input.prompt.trim();

    if name.is_empty() {
        return Err("资产名称不能为空".to_string());
    }
    if prompt.is_empty() {
        return Err("提示词不能为空".to_string());
    }

    let image_b64 = input.image_b64.as_deref().unwrap_or("").trim();
    let video_b64 = input.video_b64.as_deref().unwrap_or("").trim();
    let has_image = !image_b64.is_empty();
    let has_video = !video_b64.is_empty();

    if has_image == has_video {
        return Err("请提供图片或视频数据（且仅提供一种）".to_string());
    }

    conn.execute(
        "INSERT INTO project_assets (
            project_id, name, asset_type, prompt, model, size,
            image_path, asset_state, error_reason, created_at, updated_at,
            generation_duration_ms, num_inference_steps
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, NULL, ?8, ?8, ?9, ?10)",
        params![
            input.project_id,
            name,
            input.asset_type,
            prompt,
            input.model,
            input.size,
            ASSET_STATE_SUCCESS,
            now,
            input.generation_duration_ms,
            input.num_inference_steps,
        ],
    )
    .map_err(|e| e.to_string())?;

    let asset_id = conn.last_insert_rowid();
    let media_path = if has_video {
        match save_asset_video(&input.project_id, asset_id, video_b64) {
            Ok(path) => Some(path),
            Err(error) => {
                conn.execute(
                    "UPDATE project_assets
                     SET asset_state = ?1, error_reason = ?2, updated_at = ?3
                     WHERE id = ?4",
                    params![ASSET_STATE_ERROR, error.clone(), now, asset_id],
                )
                .map_err(|e| e.to_string())?;
                return fetch_asset_by_id(&conn, &input.project_id, asset_id);
            }
        }
    } else {
        match save_asset_image(&input.project_id, asset_id, image_b64) {
            Ok(path) => Some(path),
            Err(error) => {
                conn.execute(
                    "UPDATE project_assets
                     SET asset_state = ?1, error_reason = ?2, updated_at = ?3
                     WHERE id = ?4",
                    params![ASSET_STATE_ERROR, error.clone(), now, asset_id],
                )
                .map_err(|e| e.to_string())?;
                return fetch_asset_by_id(&conn, &input.project_id, asset_id);
            }
        }
    };

    if let Some(path) = media_path {
        conn.execute(
            "UPDATE project_assets SET image_path = ?1, updated_at = ?2 WHERE id = ?3",
            params![path, now, asset_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let record = fetch_asset_by_id(&conn, &input.project_id, asset_id)?;
    if record.asset_state == ASSET_STATE_SUCCESS {
        sync_workflow_after_assets_change(&conn, &input.project_id)?;
    }
    Ok(record)
}

#[tauri::command]
pub fn regenerate_project_asset(
    input: RegenerateProjectAssetInput,
) -> Result<ProjectAssetRecord, String> {
    let conn = init_db()?;
    let now = timestamp();
    let name = input.name.trim();
    let asset_type = input.asset_type.trim();
    let prompt = input.prompt.trim();
    let image_b64 = input.image_b64.trim();

    if name.is_empty() {
        return Err("资产名称不能为空".to_string());
    }
    if prompt.is_empty() {
        return Err("提示词不能为空".to_string());
    }
    if image_b64.is_empty() {
        return Err("请提供图片数据".to_string());
    }
    if !matches!(asset_type, "character" | "scene" | "prop") {
        return Err("资产类型无效".to_string());
    }

    let existing = fetch_asset_by_id(&conn, &input.project_id, input.asset_id)?;
    if existing.asset_type == "video" {
        return Err("视频资产不支持重新生成图片".to_string());
    }

    if let Some(old_path) = existing.image_path.as_deref() {
        let _ = remove_asset_image_file(old_path);
    }

    let media_path = match save_asset_image(&input.project_id, input.asset_id, image_b64) {
        Ok(path) => path,
        Err(error) => {
            conn.execute(
                "UPDATE project_assets
                 SET name = ?1, asset_type = ?2, prompt = ?3, asset_state = ?4,
                     error_reason = ?5, updated_at = ?6
                 WHERE id = ?7",
                params![
                    name,
                    asset_type,
                    prompt,
                    ASSET_STATE_ERROR,
                    error.clone(),
                    now,
                    input.asset_id
                ],
            )
            .map_err(|e| e.to_string())?;
            return fetch_asset_by_id(&conn, &input.project_id, input.asset_id);
        }
    };

    conn.execute(
        "UPDATE project_assets
         SET name = ?1, asset_type = ?2, prompt = ?3, image_path = ?4,
             asset_state = ?5, error_reason = NULL, updated_at = ?6,
             generation_duration_ms = ?7, num_inference_steps = ?8
         WHERE id = ?9 AND project_id = ?10",
        params![
            name,
            asset_type,
            prompt,
            media_path,
            ASSET_STATE_SUCCESS,
            now,
            input.generation_duration_ms,
            input.num_inference_steps,
            input.asset_id,
            input.project_id
        ],
    )
    .map_err(|e| e.to_string())?;

    let record = fetch_asset_by_id(&conn, &input.project_id, input.asset_id)?;
    sync_workflow_after_assets_change(&conn, &input.project_id)?;
    Ok(record)
}

#[tauri::command]
pub fn update_project_asset(input: UpdateProjectAssetInput) -> Result<ProjectAssetRecord, String> {
    let conn = init_db()?;
    let now = timestamp();
    let name = input.name.trim();
    let asset_type = input.asset_type.trim();

    if name.is_empty() {
        return Err("资产名称不能为空".to_string());
    }
    if !matches!(asset_type, "character" | "scene" | "prop" | "video") {
        return Err("资产类型无效".to_string());
    }

    fetch_asset_by_id(&conn, &input.project_id, input.asset_id)?;

    conn.execute(
        "UPDATE project_assets SET name = ?1, asset_type = ?2, updated_at = ?3 WHERE id = ?4 AND project_id = ?5",
        params![name, asset_type, now, input.asset_id, input.project_id],
    )
    .map_err(|e| e.to_string())?;

    fetch_asset_by_id(&conn, &input.project_id, input.asset_id)
}

fn remove_asset_image_file(image_path: &str) -> Result<(), String> {
    let path = PathBuf::from(image_path);
    if path.is_file() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_project_asset(input: DeleteProjectAssetInput) -> Result<(), String> {
    let conn = init_db()?;
    let asset = fetch_asset_by_id(&conn, &input.project_id, input.asset_id)?;

    let deleted = conn
        .execute(
            "DELETE FROM project_assets WHERE id = ?1 AND project_id = ?2",
            params![input.asset_id, input.project_id],
        )
        .map_err(|e| e.to_string())?;

    if deleted == 0 {
        return Err("资产不存在".to_string());
    }

    if let Some(path) = asset.image_path {
        let _ = remove_asset_image_file(&path);
    }

    sync_workflow_after_assets_change(&conn, &input.project_id)?;

    Ok(())
}

pub fn remove_project_asset_files(project_id: &str) -> Result<(), String> {
    let dir = project_assets_dir(project_id)?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn remove_all_asset_image_files() -> Result<(), String> {
    let root = assets_root_dir()?;
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn remove_asset_image_files_for_projects(project_ids: &[String]) -> Result<(), String> {
    for project_id in project_ids {
        let _ = remove_project_asset_files(project_id);
    }
    Ok(())
}

pub fn list_project_ids(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT id FROM projects")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn clear_project_assets(conn: &Connection, project_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM project_assets WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;
    let _ = remove_project_asset_files(project_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::projects::init_schema(&conn).unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects (
                id, name, project_type, novel_type, image_model, image_quality,
                video_model, video_mode, aspect_ratio, intro, art_style,
                director_manual, created_at, updated_at, current_workflow_node
            ) VALUES (
                'p1', 'Test', 'novel', 'urban', '', '', '', '', '16:9', '', '', '', 0, 0, 'generateAssets'
            )",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn list_assets_is_paginated() {
        let conn = test_conn();
        let now = 1_i64;
        for index in 0..3 {
            conn.execute(
                "INSERT INTO project_assets (
                    project_id, name, asset_type, prompt, model, size,
                    image_path, asset_state, error_reason, created_at, updated_at
                 ) VALUES ('p1', ?1, 'scene', 'prompt', 'model', '1024x1024', NULL, 1, NULL, ?2, ?2)",
                params![format!("Asset {index}"), now + index],
            )
            .unwrap();
        }

        let page = list_project_assets_internal(&conn, "p1", 1, 2, &[]).unwrap();
        assert_eq!(page.total, 3);
        assert_eq!(page.items.len(), 2);
    }
}
