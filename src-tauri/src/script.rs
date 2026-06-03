use crate::db::init_db;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

pub const SCRIPT_STATE_PENDING: i32 = 0;
pub const SCRIPT_STATE_SUCCESS: i32 = 1;
pub const SCRIPT_STATE_ERROR: i32 = 2;

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScriptWorkData {
    pub story_skeleton: String,
    pub adaptation_strategy: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptRecord {
    pub id: i64,
    pub project_id: String,
    pub episode_index: i32,
    pub name: String,
    pub content: String,
    pub script_state: i32,
    pub error_reason: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertScriptInput {
    pub project_id: String,
    pub episode_index: i32,
    pub name: String,
    pub content: String,
    pub script_state: i32,
    pub error_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetScriptWorkDataInput {
    pub project_id: String,
    pub story_skeleton: Option<String>,
    pub adaptation_strategy: Option<String>,
}

fn row_to_script(row: &Row<'_>) -> rusqlite::Result<ScriptRecord> {
    Ok(ScriptRecord {
        id: row.get(0)?,
        project_id: row.get(1)?,
        episode_index: row.get(2)?,
        name: row.get(3)?,
        content: row.get(4)?,
        script_state: row.get(5)?,
        error_reason: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

pub fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS script_work_data (
            project_id TEXT PRIMARY KEY,
            story_skeleton TEXT NOT NULL DEFAULT '',
            adaptation_strategy TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS scripts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            episode_index INTEGER NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            script_state INTEGER NOT NULL DEFAULT 0,
            error_reason TEXT,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (project_id, episode_index)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_scripts_project
         ON scripts(project_id, episode_index)",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn clear_project_script_data(conn: &Connection, project_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM script_work_data WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM scripts WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn fetch_script_work_data(conn: &Connection, project_id: &str) -> ScriptWorkData {
    conn.query_row(
        "SELECT story_skeleton, adaptation_strategy FROM script_work_data WHERE project_id = ?1",
        params![project_id],
        |row| {
            Ok(ScriptWorkData {
                story_skeleton: row.get(0)?,
                adaptation_strategy: row.get(1)?,
            })
        },
    )
    .unwrap_or_default()
}

pub fn fetch_scripts(conn: &Connection, project_id: &str) -> Result<Vec<ScriptRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, episode_index, name, content, script_state, error_reason, updated_at
             FROM scripts WHERE project_id = ?1 ORDER BY episode_index ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], row_to_script)
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn fetch_script_by_episode(
    conn: &Connection,
    project_id: &str,
    episode_index: i32,
) -> Result<Option<ScriptRecord>, String> {
    conn.query_row(
        "SELECT id, project_id, episode_index, name, content, script_state, error_reason, updated_at
         FROM scripts WHERE project_id = ?1 AND episode_index = ?2",
        params![project_id, episode_index],
        row_to_script,
    )
    .optional()
    .map_err(|e| e.to_string())
}

pub fn is_ai_script_completed(
    conn: &Connection,
    project_id: &str,
    chapter_count: i32,
) -> Result<bool, String> {
    if chapter_count <= 0 {
        return Ok(false);
    }
    let success_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM scripts
             WHERE project_id = ?1 AND script_state = ?2",
            params![project_id, SCRIPT_STATE_SUCCESS],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(success_count >= chapter_count as i64)
}

#[tauri::command]
pub fn get_script_work_data(project_id: String) -> Result<ScriptWorkData, String> {
    let conn = init_db()?;
    Ok(fetch_script_work_data(&conn, &project_id))
}

#[tauri::command]
pub fn set_script_work_data(input: SetScriptWorkDataInput) -> Result<ScriptWorkData, String> {
    let conn = init_db()?;
    let now = chrono_timestamp();
    let existing = fetch_script_work_data(&conn, &input.project_id);
    let story_skeleton = input
        .story_skeleton
        .unwrap_or(existing.story_skeleton);
    let adaptation_strategy = input
        .adaptation_strategy
        .unwrap_or(existing.adaptation_strategy);

    conn.execute(
        "INSERT INTO script_work_data (project_id, story_skeleton, adaptation_strategy, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(project_id) DO UPDATE SET
           story_skeleton = excluded.story_skeleton,
           adaptation_strategy = excluded.adaptation_strategy,
           updated_at = excluded.updated_at",
        params![
            input.project_id,
            story_skeleton,
            adaptation_strategy,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(ScriptWorkData {
        story_skeleton,
        adaptation_strategy,
    })
}

#[tauri::command]
pub fn list_scripts(project_id: String) -> Result<Vec<ScriptRecord>, String> {
    let conn = init_db()?;
    fetch_scripts(&conn, &project_id)
}

#[tauri::command]
pub fn upsert_script(input: UpsertScriptInput) -> Result<ScriptRecord, String> {
    let conn = init_db()?;
    let now = chrono_timestamp();

    conn.execute(
        "INSERT INTO scripts (
            project_id, episode_index, name, content, script_state, error_reason, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(project_id, episode_index) DO UPDATE SET
           name = excluded.name,
           content = excluded.content,
           script_state = excluded.script_state,
           error_reason = excluded.error_reason,
           updated_at = excluded.updated_at",
        params![
            input.project_id,
            input.episode_index,
            input.name,
            input.content,
            input.script_state,
            input.error_reason,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    let id: i64 = conn
        .query_row(
            "SELECT id FROM scripts WHERE project_id = ?1 AND episode_index = ?2",
            params![input.project_id, input.episode_index],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    crate::workflow::maybe_advance_after_script(&conn, &input.project_id)?;

    Ok(ScriptRecord {
        id,
        project_id: input.project_id,
        episode_index: input.episode_index,
        name: input.name,
        content: input.content,
        script_state: input.script_state,
        error_reason: input.error_reason,
        updated_at: now,
    })
}

fn chrono_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
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
                'p1', 'Test', 'novel', 'urban', '', '', '', '', '16:9', '', '', '', 0, 0, 'aiScript'
            )",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn upsert_and_list_scripts() {
        let conn = test_conn();
        let _input = UpsertScriptInput {
            project_id: "p1".to_string(),
            episode_index: 1,
            name: "EP01".to_string(),
            content: "script body".to_string(),
            script_state: SCRIPT_STATE_SUCCESS,
            error_reason: None,
        };
        conn.execute(
            "INSERT INTO scripts (
                project_id, episode_index, name, content, script_state, error_reason, updated_at
             ) VALUES ('p1', 1, 'EP01', 'script body', 1, NULL, 0)",
            [],
        )
        .unwrap();
        let scripts = fetch_scripts(&conn, "p1").unwrap();
        assert_eq!(scripts.len(), 1);
        assert_eq!(scripts[0].name, "EP01");
    }
}
