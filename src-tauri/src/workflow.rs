use crate::assets::{self, ListProjectAssetsResult};
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

/// 暂时放开：true = 剧本完成后即可进入「剪辑导出」；恢复时改为 false。
pub(crate) const EDIT_EXPORT_UNLOCK_AFTER_SCRIPT: bool = true;

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
    /// Unlocked and navigable, but not the active focus node.
    Available,
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
pub struct GenerateAssetsNodeDetail {
    pub node_id: String,
    pub scripts: Vec<ScriptRecord>,
    pub assets: ListProjectAssetsResult,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateVideoNodeDetail {
    pub node_id: String,
    pub scripts: Vec<ScriptRecord>,
    pub videos: Vec<assets::ProjectAssetRecord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditExportNodeDetail {
    pub node_id: String,
    pub scripts: Vec<ScriptRecord>,
    pub videos: Vec<assets::ProjectAssetRecord>,
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
    GenerateAssets(GenerateAssetsNodeDetail),
    GenerateVideo(GenerateVideoNodeDetail),
    EditExport(EditExportNodeDetail),
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
        NODE_GENERATE_ASSETS => assets::has_successful_non_video_assets(conn, project_id),
        NODE_GENERATE_VIDEO => assets::is_generate_video_completed(conn, project_id),
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
    } else if (current == NODE_GENERATE_ASSETS || current == NODE_STORYBOARD)
        && is_node_completed(conn, project_id, NODE_GENERATE_ASSETS)?
    {
        set_project_current_node(conn, project_id, NODE_GENERATE_VIDEO)?;
    } else if (current == NODE_GENERATE_VIDEO || current == NODE_STORYBOARD)
        && is_node_completed(conn, project_id, NODE_GENERATE_VIDEO)?
    {
        set_project_current_node(conn, project_id, NODE_EDIT_EXPORT)?;
    } else if !EDIT_EXPORT_UNLOCK_AFTER_SCRIPT
        && current == NODE_EDIT_EXPORT
        && !is_node_completed(conn, project_id, NODE_GENERATE_VIDEO)?
    {
        set_project_current_node(conn, project_id, NODE_GENERATE_VIDEO)?;
    }
    Ok(())
}

fn node_index(node_id: &str) -> Option<usize> {
    WORKFLOW_NODE_IDS.iter().position(|id| *id == node_id)
}

/// Whether a node is unlocked for navigation (parallel branches allowed after script).
fn is_node_available(node_id: &str, completions: &[bool]) -> bool {
    let idx = |id: &str| node_index(id).unwrap_or(0);
    match node_id {
        NODE_EXTRACT_EVENTS => true,
        NODE_AI_SCRIPT => completions[idx(NODE_EXTRACT_EVENTS)],
        NODE_GENERATE_ASSETS | NODE_GENERATE_VIDEO => completions[idx(NODE_AI_SCRIPT)],
        NODE_STORYBOARD => false,
        NODE_EDIT_EXPORT => {
            if EDIT_EXPORT_UNLOCK_AFTER_SCRIPT {
                completions[idx(NODE_AI_SCRIPT)]
            } else {
                completions[idx(NODE_GENERATE_VIDEO)]
            }
        }
        _ => false,
    }
}

fn compute_node_statuses(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<WorkflowNodeStatus>, String> {
    let in_progress = novel::is_event_extraction_in_progress(conn, project_id)?;

    if !in_progress {
        sync_current_node(conn, project_id)?;
    }

    let current_node = if in_progress {
        NODE_EXTRACT_EVENTS.to_string()
    } else {
        get_project_current_node(conn, project_id)?
    };

    let completions: Vec<bool> = WORKFLOW_NODE_IDS
        .iter()
        .map(|node_id| is_node_completed(conn, project_id, node_id))
        .collect::<Result<_, _>>()?;

    Ok(WORKFLOW_NODE_IDS
        .iter()
        .enumerate()
        .map(|(index, node_id)| {
            if in_progress && *node_id == NODE_EXTRACT_EVENTS {
                WorkflowNodeStatus::Current
            } else if *node_id == current_node.as_str() {
                WorkflowNodeStatus::Current
            } else if completions[index] {
                WorkflowNodeStatus::Completed
            } else if is_node_available(node_id, &completions) {
                WorkflowNodeStatus::Available
            } else {
                WorkflowNodeStatus::NotStarted
            }
        })
        .collect())
}

pub(crate) fn build_workflow_nodes(conn: &Connection, project_id: &str) -> Result<Vec<ProjectWorkflowNode>, String> {
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
        NODE_GENERATE_ASSETS => Ok(WorkflowNodeDetail::GenerateAssets(
            GenerateAssetsNodeDetail {
                node_id: input.node_id,
                scripts: script::fetch_scripts(&conn, &input.project_id)?,
                assets: assets::list_project_assets_internal(
                    &conn,
                    &input.project_id,
                    1,
                    10,
                    &["video".to_string()],
                )?,
            },
        )),
        NODE_GENERATE_VIDEO => Ok(WorkflowNodeDetail::GenerateVideo(GenerateVideoNodeDetail {
            node_id: input.node_id,
            scripts: script::fetch_scripts(&conn, &input.project_id)?,
            videos: assets::fetch_project_video_assets(&conn, &input.project_id)?,
        })),
        NODE_EDIT_EXPORT => Ok(WorkflowNodeDetail::EditExport(EditExportNodeDetail {
            node_id: input.node_id,
            scripts: script::fetch_scripts(&conn, &input.project_id)?,
            videos: assets::fetch_project_video_assets(&conn, &input.project_id)?,
        })),
        _ => Ok(WorkflowNodeDetail::Placeholder(PlaceholderNodeDetail {
            node_id: input.node_id,
        })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::novel;
    use rusqlite::{params, Connection};

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::projects::init_schema(&conn).unwrap();
        novel::init_schema(&conn).unwrap();
        script::init_schema(&conn).unwrap();
        assets::init_schema(&conn).unwrap();
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
    fn advances_to_generate_video_when_assets_exist() {
        let conn = test_conn();
        conn.execute(
            "UPDATE projects SET current_workflow_node = 'generateAssets' WHERE id = 'p1'",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO project_assets (
                project_id, name, asset_type, prompt, model, size, image_path,
                asset_state, error_reason, created_at, updated_at
             ) VALUES ('p1', 'Boss', 'character', 'boss', 'qwen', '1024x1024', '/tmp/a.png', 1, NULL, 1, 1)",
            [],
        )
        .unwrap();

        let nodes = build_workflow_nodes(&conn, "p1").unwrap();
        assert_eq!(nodes[2].status, WorkflowNodeStatus::Completed);
        assert_eq!(nodes[4].status, WorkflowNodeStatus::Current);
    }

    #[test]
    fn advances_to_edit_export_when_all_scripts_have_videos() {
        let conn = test_conn();
        conn.execute(
            "UPDATE projects SET current_workflow_node = 'generateVideo' WHERE id = 'p1'",
            [],
        )
        .unwrap();
        for (index, name) in ["EP01", "EP02"].iter().enumerate() {
            conn.execute(
                "INSERT INTO scripts (
                    project_id, episode_index, name, content, script_state, error_reason, updated_at
                ) VALUES ('p1', ?1, ?2, 'script', 1, NULL, 1)",
                params![(index + 1) as i32, name],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO project_assets (
                    project_id, name, asset_type, prompt, model, size, image_path,
                    asset_state, error_reason, created_at, updated_at
                 ) VALUES ('p1', ?1, 'video', 'prompt', 'wan', '832x480', '/tmp/v.mp4', 1, NULL, 1, 1)",
                params![name],
            )
            .unwrap();
        }

        let nodes = build_workflow_nodes(&conn, "p1").unwrap();
        assert_eq!(nodes[4].status, WorkflowNodeStatus::Completed);
        assert_eq!(nodes[5].status, WorkflowNodeStatus::Current);
    }

    #[test]
    fn unlocks_assets_and_video_after_script_complete() {
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
        conn.execute(
            "INSERT INTO scripts (
                project_id, episode_index, name, content, script_state, error_reason, updated_at
            ) VALUES ('p1', 1, 'EP01', 'script', 1, NULL, 1)",
            [],
        )
        .unwrap();

        maybe_advance_after_extract(&conn, "p1").unwrap();
        maybe_advance_after_script(&conn, "p1").unwrap();

        let nodes = build_workflow_nodes(&conn, "p1").unwrap();
        assert_eq!(nodes[1].status, WorkflowNodeStatus::Completed);
        assert_eq!(nodes[2].status, WorkflowNodeStatus::Current);
        assert_eq!(nodes[4].status, WorkflowNodeStatus::Available);
        assert_eq!(nodes[5].status, WorkflowNodeStatus::Available);
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
