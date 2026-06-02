use crate::db::init_db;
use crate::novel::{self, NovelChapterRecord, NovelSourceRecord};
use crate::projects::{get_project_current_node, set_project_current_node};
use crate::script::{self, ScriptRecord, ScriptWorkData};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

pub const NODE_EXTRACT_EVENTS: &str = "extractEvents";
pub const NODE_AI_SCRIPT: &str = "aiScript";
pub const NODE_GENERATE_ASSETS: &str = "generateAssets";
pub const NODE_STORYBOARD: &str = "storyboard";
pub const NODE_GENERATE_VIDEO: &str = "generateVideo";
pub const NODE_EDIT_EXPORT: &str = "editExport";

const WORKFLOW_NODE_IDS: &[&str] = &[
    NODE_EXTRACT_EVENTS,
    NODE_AI_SCRIPT,
    NODE_GENERATE_ASSETS,
    NODE_STORYBOARD,
    NODE_GENERATE_VIDEO,
    NODE_EDIT_EXPORT,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkflowNodeStatus {
    Completed,
    Current,
    NotStarted,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWorkflowNode {
    pub id: String,
    pub order: i32,
    pub status: WorkflowNodeStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelChaptersNodeDetail {
    pub node_id: String,
    pub source: Option<NovelSourceRecord>,
    pub chapters: Vec<NovelChapterRecord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiScriptNodeDetail {
    pub node_id: String,
    pub source: Option<NovelSourceRecord>,
    pub chapters: Vec<NovelChapterRecord>,
    pub work_data: ScriptWorkData,
    pub scripts: Vec<ScriptRecord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceholderNodeDetail {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WorkflowNodeDetail {
    ExtractEvents(NovelChaptersNodeDetail),
    AiScript(AiScriptNodeDetail),
    Placeholder(PlaceholderNodeDetail),
}

fn ensure_project_exists(conn: &Connection, project_id: &str) -> Result<(), String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM projects WHERE id = ?1",
            rusqlite::params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if count == 0 {
        return Err(format!("项目不存在: {project_id}"));
    }
    Ok(())
}

fn is_node_completed(conn: &Connection, project_id: &str, node_id: &str) -> Result<bool, String> {
    match node_id {
        NODE_EXTRACT_EVENTS => {
            let chapters = novel::fetch_novel_chapters(conn, project_id)?;
            Ok(novel::is_extract_events_completed(&chapters))
        }
        NODE_AI_SCRIPT => {
            let chapters = novel::fetch_novel_chapters(conn, project_id)?;
            script::is_ai_script_completed(conn, project_id, chapters.len() as i32)
        }
        _ => Ok(false),
    }
}

pub(crate) fn reset_to_extract_events(conn: &Connection, project_id: &str) -> Result<(), String> {
    set_project_current_node(conn, project_id, NODE_EXTRACT_EVENTS)
}

pub(crate) fn maybe_advance_after_extract(conn: &Connection, project_id: &str) -> Result<(), String> {
    if is_node_completed(conn, project_id, NODE_EXTRACT_EVENTS)? {
        set_project_current_node(conn, project_id, NODE_AI_SCRIPT)?;
    }
    Ok(())
}

pub(crate) fn maybe_advance_after_script(conn: &Connection, project_id: &str) -> Result<(), String> {
    if is_node_completed(conn, project_id, NODE_AI_SCRIPT)? {
        set_project_current_node(conn, project_id, NODE_GENERATE_ASSETS)?;
    }
    Ok(())
}

fn sync_current_node(conn: &Connection, project_id: &str) -> Result<(), String> {
    let current = get_project_current_node(conn, project_id)?;
    if current == NODE_EXTRACT_EVENTS
        && is_node_completed(conn, project_id, NODE_EXTRACT_EVENTS)?
    {
        set_project_current_node(conn, project_id, NODE_AI_SCRIPT)?;
    } else if current == NODE_AI_SCRIPT
        && is_node_completed(conn, project_id, NODE_AI_SCRIPT)?
    {
        set_project_current_node(conn, project_id, NODE_GENERATE_ASSETS)?;
    }
    Ok(())
}

fn compute_node_statuses(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<WorkflowNodeStatus>, String> {
    sync_current_node(conn, project_id)?;
    let current_node = get_project_current_node(conn, project_id)?;
    let completions: Vec<bool> = WORKFLOW_NODE_IDS
        .iter()
        .map(|node_id| is_node_completed(conn, project_id, node_id))
        .collect::<Result<_, _>>()?;

    Ok(WORKFLOW_NODE_IDS
        .iter()
        .enumerate()
        .map(|(index, node_id)| {
            if *node_id == current_node.as_str() {
                WorkflowNodeStatus::Current
            } else if completions[index] {
                WorkflowNodeStatus::Completed
            } else {
                WorkflowNodeStatus::NotStarted
            }
        })
        .collect())
}

fn build_workflow_nodes(conn: &Connection, project_id: &str) -> Result<Vec<ProjectWorkflowNode>, String> {
    let statuses = compute_node_statuses(conn, project_id)?;

    Ok(WORKFLOW_NODE_IDS
        .iter()
        .enumerate()
        .map(|(index, node_id)| ProjectWorkflowNode {
            id: (*node_id).to_string(),
            order: index as i32,
            status: statuses[index],
        })
        .collect())
}

fn fetch_chapters_node_detail(
    conn: &Connection,
    project_id: &str,
    node_id: &str,
) -> Result<NovelChaptersNodeDetail, String> {
    Ok(NovelChaptersNodeDetail {
        node_id: node_id.to_string(),
        source: novel::fetch_novel_source(conn, project_id)?,
        chapters: novel::fetch_novel_chapters(conn, project_id)?,
    })
}

#[tauri::command]
pub fn list_project_workflow_nodes(project_id: String) -> Result<Vec<ProjectWorkflowNode>, String> {
    let conn = init_db()?;
    ensure_project_exists(&conn, &project_id)?;
    build_workflow_nodes(&conn, &project_id)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetWorkflowNodeDetailInput {
    pub project_id: String,
    pub node_id: String,
}

#[tauri::command]
pub fn get_project_workflow_node_detail(
    input: GetWorkflowNodeDetailInput,
) -> Result<WorkflowNodeDetail, String> {
    let conn = init_db()?;
    ensure_project_exists(&conn, &input.project_id)?;

    if !WORKFLOW_NODE_IDS.contains(&input.node_id.as_str()) {
        return Err(format!("未知流程节点: {}", input.node_id));
    }

    match input.node_id.as_str() {
        NODE_EXTRACT_EVENTS => {
            let detail = fetch_chapters_node_detail(&conn, &input.project_id, &input.node_id)?;
            Ok(WorkflowNodeDetail::ExtractEvents(detail))
        }
        NODE_AI_SCRIPT => {
            let chapters = novel::fetch_novel_chapters(&conn, &input.project_id)?;
            Ok(WorkflowNodeDetail::AiScript(AiScriptNodeDetail {
                node_id: input.node_id,
                source: novel::fetch_novel_source(&conn, &input.project_id)?,
                chapters,
                work_data: script::fetch_script_work_data(&conn, &input.project_id),
                scripts: script::fetch_scripts(&conn, &input.project_id)?,
            }))
        }
        _ => Ok(WorkflowNodeDetail::Placeholder(PlaceholderNodeDetail {
            node_id: input.node_id,
        })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::novel;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::projects::init_schema(&conn).unwrap();
        novel::init_schema(&conn).unwrap();
        script::init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects (
                id, name, project_type, novel_type, image_model, image_quality,
                video_model, video_mode, aspect_ratio, intro, art_style,
                director_manual, created_at, updated_at, current_workflow_node
            ) VALUES (
                'p1', 'Test', 'novel', 'urban', '', '', '', '', '16:9', '', '', '', 0, 0, 'extractEvents'
            )",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn first_node_is_current_when_empty() {
        let conn = test_conn();
        let nodes = build_workflow_nodes(&conn, "p1").unwrap();
        assert_eq!(nodes[0].status, WorkflowNodeStatus::Current);
        assert_eq!(nodes[1].status, WorkflowNodeStatus::NotStarted);
    }

    #[test]
    fn advances_current_node_after_extract_complete() {
        let conn = test_conn();
        let imported_at = 1_i64;
        conn.execute(
            "INSERT INTO novel_chapters (
                project_id, chapter_index, reel, chapter, chapter_data,
                event_state, event, error_reason, created_at
            ) VALUES ('p1', 1, '正文卷', '第一章', 'content', 1, 'event', NULL, ?1)",
            rusqlite::params![imported_at],
        )
        .unwrap();

        maybe_advance_after_extract(&conn, "p1").unwrap();
        let nodes = build_workflow_nodes(&conn, "p1").unwrap();
        assert_eq!(nodes[0].status, WorkflowNodeStatus::Completed);
        assert_eq!(nodes[1].status, WorkflowNodeStatus::Current);
    }
}
