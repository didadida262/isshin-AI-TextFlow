use crate::db::init_db;
use crate::projects::{self, Project};
use crate::script::{self as script_store, SCRIPT_STATE_ERROR, SCRIPT_STATE_SUCCESS};
use crate::workflow::{self, ProjectWorkflowNode};
use rusqlite::{params, Connection};
use serde::Serialize;

const EVENT_STATE_SUCCESS: i32 = 1;
const EVENT_STATE_ERROR: i32 = 2;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantProjectSummary {
    pub has_novel_source: bool,
    pub novel_char_count: i32,
    pub chapter_count: i64,
    pub events_success_count: i64,
    pub events_pending_count: i64,
    pub events_error_count: i64,
    pub has_story_skeleton: bool,
    pub has_adaptation_strategy: bool,
    pub scripts_success_count: i64,
    pub scripts_error_count: i64,
    pub scripts_pending_count: i64,
    pub assets_total_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantProjectContext {
    pub id: String,
    pub name: String,
    pub project_type: String,
    pub novel_type: String,
    pub aspect_ratio: String,
    pub intro: String,
    pub art_style: String,
    pub director_manual: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub current_workflow_node: String,
    pub workflow_nodes: Vec<ProjectWorkflowNode>,
    pub summary: AssistantProjectSummary,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantContextResult {
    pub project_count: usize,
    pub projects: Vec<AssistantProjectContext>,
}

fn count_where(
    conn: &Connection,
    sql: &str,
    project_id: &str,
) -> Result<i64, String> {
    conn.query_row(sql, params![project_id], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())
}

fn fetch_project_summary(
    conn: &Connection,
    project_id: &str,
) -> Result<AssistantProjectSummary, String> {
    let novel_source_count = count_where(
        conn,
        "SELECT COUNT(*) FROM novel_source WHERE project_id = ?1",
        project_id,
    )?;
    let has_novel_source = novel_source_count > 0;

    let novel_char_count: i32 = if has_novel_source {
        conn.query_row(
            "SELECT char_count FROM novel_source WHERE project_id = ?1",
            params![project_id],
            |row| row.get::<_, i32>(0),
        )
        .map_err(|e| e.to_string())?
    } else {
        0
    };

    let chapter_count = count_where(
        conn,
        "SELECT COUNT(*) FROM novel_chapters WHERE project_id = ?1",
        project_id,
    )?;
    let events_success_count = conn
        .query_row(
            "SELECT COUNT(*) FROM novel_chapters WHERE project_id = ?1 AND event_state = ?2",
            params![project_id, EVENT_STATE_SUCCESS],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?;
    let events_error_count = conn
        .query_row(
            "SELECT COUNT(*) FROM novel_chapters WHERE project_id = ?1 AND event_state = ?2",
            params![project_id, EVENT_STATE_ERROR],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?;
    let events_pending_count = chapter_count - events_success_count - events_error_count;

    let work_data = script_store::fetch_script_work_data(conn, project_id);
    let has_story_skeleton = !work_data.story_skeleton.trim().is_empty();
    let has_adaptation_strategy = !work_data.adaptation_strategy.trim().is_empty();

    let scripts_success_count = conn
        .query_row(
            "SELECT COUNT(*) FROM scripts WHERE project_id = ?1 AND script_state = ?2",
            params![project_id, SCRIPT_STATE_SUCCESS],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?;
    let scripts_error_count = conn
        .query_row(
            "SELECT COUNT(*) FROM scripts WHERE project_id = ?1 AND script_state = ?2",
            params![project_id, SCRIPT_STATE_ERROR],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?;
    let scripts_total = conn
        .query_row(
            "SELECT COUNT(*) FROM scripts WHERE project_id = ?1",
            params![project_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?;
    let scripts_pending_count = scripts_total - scripts_success_count - scripts_error_count;

    let assets_total_count = count_where(
        conn,
        "SELECT COUNT(*) FROM project_assets WHERE project_id = ?1",
        project_id,
    )?;

    Ok(AssistantProjectSummary {
        has_novel_source,
        novel_char_count,
        chapter_count,
        events_success_count,
        events_pending_count,
        events_error_count,
        has_story_skeleton,
        has_adaptation_strategy,
        scripts_success_count,
        scripts_error_count,
        scripts_pending_count,
        assets_total_count,
    })
}

fn project_to_context(conn: &Connection, project: Project) -> Result<AssistantProjectContext, String> {
    let current_workflow_node = projects::get_project_current_node(conn, &project.id)?;
    let workflow_nodes = workflow::build_workflow_nodes(conn, &project.id)?;
    let summary = fetch_project_summary(conn, &project.id)?;

    Ok(AssistantProjectContext {
        id: project.id,
        name: project.name,
        project_type: project.project_type,
        novel_type: project.novel_type,
        aspect_ratio: project.aspect_ratio,
        intro: project.intro,
        art_style: project.art_style,
        director_manual: project.director_manual,
        created_at: project.created_at,
        updated_at: project.updated_at,
        current_workflow_node,
        workflow_nodes,
        summary,
    })
}

#[tauri::command]
pub fn query_assistant_context() -> Result<AssistantContextResult, String> {
    let conn = init_db()?;
    let projects = projects::list_projects_internal(&conn)?;
    let contexts = projects
        .into_iter()
        .map(|project| project_to_context(&conn, project))
        .collect::<Result<Vec<_>, _>>()?;
    let project_count = contexts.len();

    Ok(AssistantContextResult {
        project_count,
        projects: contexts,
    })
}
