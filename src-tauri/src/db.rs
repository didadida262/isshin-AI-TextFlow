use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSession {
    pub id: i64,
    pub username: String,
    pub display_name: String,
}

fn walk_up_find_data_dir(mut start: PathBuf) -> Option<PathBuf> {
    for _ in 0..10 {
        let data = start.join("data");
        if data.is_dir() {
            return data.canonicalize().ok().or(Some(data));
        }
        if !start.pop() {
            break;
        }
    }
    None
}

fn sqlite_dir() -> Result<PathBuf, String> {
    if let Ok(cwd) = std::env::current_dir() {
        if let Some(data) = walk_up_find_data_dir(cwd) {
            let dir = data.join("sqlite");
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            return Ok(dir);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if let Some(data) = walk_up_find_data_dir(parent.to_path_buf()) {
                let dir = data.join("sqlite");
                std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
                return Ok(dir);
            }
        }
    }

    let data = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../data");
    if data.is_dir() {
        let dir = data.join("sqlite");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        return dir.canonicalize().map_err(|e| e.to_string());
    }

    Err("未找到 data/sqlite 目录".to_string())
}

fn db_path() -> Result<PathBuf, String> {
    Ok(sqlite_dir()?.join("app.db"))
}

pub fn database_file_path() -> Result<String, String> {
    db_path()?
        .to_str()
        .map(str::to_string)
        .ok_or_else(|| "数据库路径无效".to_string())
}

pub fn seed_default_admin(conn: &Connection) -> Result<(), String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if count == 0 {
        conn.execute(
            "INSERT INTO users (username, password, display_name) VALUES (?1, ?2, ?3)",
            params!["admin", "admin", "admin"],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn init_db() -> Result<Connection, String> {
    let path = db_path()?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            display_name TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    seed_default_admin(&conn)?;

    crate::projects::init_schema(&conn)?;
    crate::novel::init_schema(&conn)?;
    crate::script::init_schema(&conn)?;
    crate::assets::init_schema(&conn)?;

    Ok(conn)
}

#[tauri::command]
pub fn login(username: String, password: String) -> Result<UserSession, String> {
    let conn = init_db()?;
    conn.query_row(
        "SELECT id, username, display_name FROM users WHERE username = ?1 AND password = ?2",
        params![username.trim(), password],
        |row| {
            Ok(UserSession {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
            })
        },
    )
    .map_err(|_| "用户名或密码错误".to_string())
}
