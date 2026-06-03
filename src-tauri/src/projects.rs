use crate::assets;
use crate::db::init_db;
use crate::novel;
use crate::script;
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub project_type: String,
    pub novel_type: String,
    pub image_model: String,
    pub image_quality: String,
    pub video_model: String,
    pub video_mode: String,
    pub aspect_ratio: String,
    pub intro: String,
    pub art_style: String,
    pub director_manual: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub id: String,
    pub name: String,
    pub project_type: String,
    pub novel_type: String,
    pub image_model: String,
    pub image_quality: String,
    pub video_model: String,
    pub video_mode: String,
    pub aspect_ratio: String,
    pub intro: String,
    pub art_style: String,
    pub director_manual: String,
    pub created_at: i64,
}

fn row_to_project(row: &Row<'_>) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        project_type: row.get(2)?,
        novel_type: row.get(3)?,
        image_model: row.get(4)?,
        image_quality: row.get(5)?,
        video_model: row.get(6)?,
        video_mode: row.get(7)?,
        aspect_ratio: row.get(8)?,
        intro: row.get(9)?,
        art_style: row.get(10)?,
        director_manual: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

const PROJECT_SELECT: &str = "SELECT id, name, project_type, novel_type, image_model, image_quality, video_model, video_mode, aspect_ratio, intro, art_style, director_manual, created_at, updated_at FROM projects";

pub fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            project_type TEXT NOT NULL,
            novel_type TEXT NOT NULL,
            image_model TEXT NOT NULL,
            image_quality TEXT NOT NULL,
            video_model TEXT NOT NULL,
            video_mode TEXT NOT NULL,
            aspect_ratio TEXT NOT NULL,
            intro TEXT NOT NULL,
            art_style TEXT NOT NULL,
            director_manual TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            current_workflow_node TEXT NOT NULL DEFAULT 'extractEvents'
        )",
        [],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())?;

    migrate_projects_schema(conn)?;

    Ok(())
}

fn migrate_projects_schema(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(projects)")
        .map_err(|e| e.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if !columns.iter().any(|name| name == "current_workflow_node") {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN current_workflow_node TEXT NOT NULL DEFAULT 'extractEvents'",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn insert_project(conn: &Connection, input: &ProjectInput, updated_at: i64) -> Result<Project, String> {
    conn.execute(
        "INSERT INTO projects (
            id, name, project_type, novel_type, image_model, image_quality,
            video_model, video_mode, aspect_ratio, intro, art_style, director_manual,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            input.id,
            input.name,
            input.project_type,
            input.novel_type,
            input.image_model,
            input.image_quality,
            input.video_model,
            input.video_mode,
            input.aspect_ratio,
            input.intro,
            input.art_style,
            input.director_manual,
            input.created_at,
            updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    get_project_by_id(conn, &input.id)
}

pub(crate) fn set_project_current_node(
    conn: &Connection,
    project_id: &str,
    node_id: &str,
) -> Result<(), String> {
    let updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    let affected = conn
        .execute(
            "UPDATE projects SET current_workflow_node = ?2, updated_at = ?3 WHERE id = ?1",
            params![project_id, node_id, updated_at],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("项目不存在: {project_id}"));
    }

    Ok(())
}

pub(crate) fn get_project_current_node(
    conn: &Connection,
    project_id: &str,
) -> Result<String, String> {
    conn.query_row(
        "SELECT current_workflow_node FROM projects WHERE id = ?1",
        params![project_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

fn get_project_by_id(conn: &Connection, id: &str) -> Result<Project, String> {
    conn.query_row(
        &format!("{PROJECT_SELECT} WHERE id = ?1"),
        params![id],
        row_to_project,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(input: ProjectInput) -> Result<Project, String> {
    let conn = init_db()?;
    insert_project(&conn, &input, input.created_at)
}

pub(crate) fn list_projects_internal(conn: &Connection) -> Result<Vec<Project>, String> {
    let mut stmt = conn
        .prepare(&format!("{PROJECT_SELECT} ORDER BY created_at DESC"))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], row_to_project)
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_projects() -> Result<Vec<Project>, String> {
    let conn = init_db()?;
    list_projects_internal(&conn)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectInput {
    pub id: String,
    pub name: String,
    pub project_type: String,
    pub novel_type: String,
    pub image_model: String,
    pub image_quality: String,
    pub video_model: String,
    pub video_mode: String,
    pub aspect_ratio: String,
    pub intro: String,
    pub art_style: String,
    pub director_manual: String,
}

#[tauri::command]
pub fn update_project(input: UpdateProjectInput) -> Result<Project, String> {
    let conn = init_db()?;
    let updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    let affected = conn
        .execute(
            "UPDATE projects SET
                name = ?2,
                project_type = ?3,
                novel_type = ?4,
                image_model = ?5,
                image_quality = ?6,
                video_model = ?7,
                video_mode = ?8,
                aspect_ratio = ?9,
                intro = ?10,
                art_style = ?11,
                director_manual = ?12,
                updated_at = ?13
            WHERE id = ?1",
            params![
                input.id,
                input.name,
                input.project_type,
                input.novel_type,
                input.image_model,
                input.image_quality,
                input.video_model,
                input.video_mode,
                input.aspect_ratio,
                input.intro,
                input.art_style,
                input.director_manual,
                updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("项目不存在: {}", input.id));
    }

    get_project_by_id(&conn, &input.id)
}

#[tauri::command]
pub fn delete_project(project_id: String) -> Result<(), String> {
    let id = project_id.trim();
    if id.is_empty() {
        return Err("项目 ID 无效".to_string());
    }

    let conn = init_db()?;
    get_project_by_id(&conn, id)?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;

    assets::clear_project_assets(&tx, id)?;
    script::clear_project_script_data(&tx, id)?;
    novel::clear_project_novel_data(&tx, id)?;

    let affected = tx
        .execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("项目不存在: {id}"));
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
