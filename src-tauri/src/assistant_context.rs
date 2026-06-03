use crate::db::init_db;
use crate::projects::{self, Project};
use crate::script::{self as script_store, ScriptRecord, SCRIPT_STATE_ERROR, SCRIPT_STATE_SUCCESS};
use crate::workflow::{self, ProjectWorkflowNode};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

const EVENT_STATE_SUCCESS: i32 = 1;
const EVENT_STATE_ERROR: i32 = 2;
const MAX_SCRIPT_CONTENT_CHARS: usize = 12_000;
const SCRIPT_PREVIEW_CHARS: usize = 200;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryAssistantContextInput {
    pub query_kind: String,
    pub episode_index: Option<i32>,
    pub user_message: String,
}

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
pub struct AssistantProjectBrief {
    pub id: String,
    pub name: String,
    pub current_workflow_node: String,
    pub summary: AssistantProjectSummary,
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
pub struct AssistantScriptBrief {
    pub episode_index: i32,
    pub name: String,
    pub script_state: i32,
    pub content_length: usize,
    pub content_preview: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantScriptRecord {
    pub id: i64,
    pub project_id: String,
    pub episode_index: i32,
    pub name: String,
    pub content: String,
    pub script_state: i32,
    pub error_reason: Option<String>,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_truncated: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantContextResult {
    pub query_kind: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<AssistantProjectContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projects: Option<Vec<AssistantProjectBrief>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<AssistantScriptRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scripts: Option<Vec<AssistantScriptBrief>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub story_skeleton: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaptation_strategy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_hint: Option<String>,
}

fn count_where(conn: &Connection, sql: &str, project_id: &str) -> Result<i64, String> {
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

fn project_to_brief(conn: &Connection, project: &Project) -> Result<AssistantProjectBrief, String> {
    let current_workflow_node = projects::get_project_current_node(conn, &project.id)?;
    let summary = fetch_project_summary(conn, &project.id)?;

    Ok(AssistantProjectBrief {
        id: project.id.clone(),
        name: project.name.clone(),
        current_workflow_node,
        summary,
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

fn resolve_target_project(conn: &Connection, user_message: &str) -> Result<(Project, String), String> {
    let mut projects = projects::list_projects_internal(conn)?;
    if projects.is_empty() {
        return Err("暂无项目，请先创建项目。".to_string());
    }

    let mut name_matches: Vec<&Project> = projects
        .iter()
        .filter(|project| user_message.contains(&project.name))
        .collect();
    name_matches.sort_by_key(|project| std::cmp::Reverse(project.name.len()));
    if let Some(project) = name_matches.first() {
        return Ok((
            (*project).clone(),
            format!("已匹配项目「{}」", project.name),
        ));
    }

    if projects.len() == 1 {
        let project = projects.remove(0);
        let name = project.name.clone();
        return Ok((project, format!("当前唯一项目「{name}」")));
    }

    projects.sort_by_key(|project| std::cmp::Reverse(project.updated_at));
    let project = projects.remove(0);
    Ok((
        project.clone(),
        format!(
            "未在问题中指明项目，默认使用最近更新的项目「{}」",
            project.name
        ),
    ))
}

fn truncate_chars(text: &str, max_chars: usize) -> (String, bool) {
    let char_count = text.chars().count();
    if char_count <= max_chars {
        return (text.to_string(), false);
    }
    let truncated: String = text.chars().take(max_chars).collect();
    (truncated, true)
}

fn script_preview(content: &str) -> String {
    truncate_chars(content, SCRIPT_PREVIEW_CHARS).0
}

fn script_to_assistant(record: ScriptRecord) -> AssistantScriptRecord {
    let (content, truncated) = truncate_chars(&record.content, MAX_SCRIPT_CONTENT_CHARS);
    AssistantScriptRecord {
        id: record.id,
        project_id: record.project_id,
        episode_index: record.episode_index,
        name: record.name,
        content,
        script_state: record.script_state,
        error_reason: record.error_reason,
        updated_at: record.updated_at,
        content_truncated: if truncated { Some(true) } else { None },
    }
}

fn script_to_brief(record: &ScriptRecord) -> AssistantScriptBrief {
    AssistantScriptBrief {
        episode_index: record.episode_index,
        name: record.name.clone(),
        script_state: record.script_state,
        content_length: record.content.chars().count(),
        content_preview: script_preview(&record.content),
    }
}

fn available_episodes_hint(conn: &Connection, project_id: &str) -> Result<String, String> {
    let scripts = script_store::fetch_scripts(conn, project_id)?;
    if scripts.is_empty() {
        return Ok("该项目尚无剧本记录。".to_string());
    }
    let episodes: Vec<String> = scripts
        .iter()
        .map(|script| format!("第{}集({})", script.episode_index, script.name))
        .collect();
    Ok(format!("已有剧本：{}", episodes.join("、")))
}

fn query_project_list(conn: &Connection) -> Result<AssistantContextResult, String> {
    let projects = projects::list_projects_internal(conn)?;
    let briefs = projects
        .iter()
        .map(|project| project_to_brief(conn, project))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(AssistantContextResult {
        query_kind: "project_list".to_string(),
        description: format!("共 {} 个项目（简要进度）", briefs.len()),
        project: None,
        projects: Some(briefs),
        script: None,
        scripts: None,
        story_skeleton: None,
        adaptation_strategy: None,
        error_hint: None,
    })
}

fn query_project_detail(
    conn: &Connection,
    user_message: &str,
) -> Result<AssistantContextResult, String> {
    let (project, scope_note) = resolve_target_project(conn, user_message)?;
    let context = project_to_context(conn, project)?;

    Ok(AssistantContextResult {
        query_kind: "project_detail".to_string(),
        description: format!("项目「{}」进度详情（{}）", context.name, scope_note),
        project: Some(context),
        projects: None,
        script: None,
        scripts: None,
        story_skeleton: None,
        adaptation_strategy: None,
        error_hint: None,
    })
}

fn query_script_episode(
    conn: &Connection,
    user_message: &str,
    episode_index: i32,
) -> Result<AssistantContextResult, String> {
    let (project, scope_note) = resolve_target_project(conn, user_message)?;
    let script = script_store::fetch_script_by_episode(conn, &project.id, episode_index)?;

    if let Some(record) = script {
        let assistant_script = script_to_assistant(record);
        return Ok(AssistantContextResult {
            query_kind: "script_episode".to_string(),
            description: format!(
                "项目「{}」第 {} 集剧本「{}」（{}）",
                project.name, episode_index, assistant_script.name, scope_note
            ),
            project: None,
            projects: None,
            script: Some(assistant_script),
            scripts: None,
            story_skeleton: None,
            adaptation_strategy: None,
            error_hint: None,
        });
    }

    let hint = available_episodes_hint(conn, &project.id)?;
    Ok(AssistantContextResult {
        query_kind: "script_episode".to_string(),
        description: format!(
            "项目「{}」未找到第 {} 集剧本（{}）",
            project.name, episode_index, scope_note
        ),
        project: None,
        projects: None,
        script: None,
        scripts: None,
        story_skeleton: None,
        adaptation_strategy: None,
        error_hint: Some(hint),
    })
}

fn query_script_list(
    conn: &Connection,
    user_message: &str,
) -> Result<AssistantContextResult, String> {
    let (project, scope_note) = resolve_target_project(conn, user_message)?;
    let records = script_store::fetch_scripts(conn, &project.id)?;
    let scripts: Vec<AssistantScriptBrief> = records.iter().map(script_to_brief).collect();

    Ok(AssistantContextResult {
        query_kind: "script_list".to_string(),
        description: format!(
            "项目「{}」共 {} 条剧本记录（{}）",
            project.name,
            scripts.len(),
            scope_note
        ),
        project: None,
        projects: None,
        script: None,
        scripts: Some(scripts),
        story_skeleton: None,
        adaptation_strategy: None,
        error_hint: if scripts.is_empty() {
            Some("该项目尚无剧本，请先生成剧本。".to_string())
        } else {
            None
        },
    })
}

fn query_story_skeleton(
    conn: &Connection,
    user_message: &str,
) -> Result<AssistantContextResult, String> {
    let (project, scope_note) = resolve_target_project(conn, user_message)?;
    let work_data = script_store::fetch_script_work_data(conn, &project.id);
    let skeleton = work_data.story_skeleton.trim().to_string();

    Ok(AssistantContextResult {
        query_kind: "story_skeleton".to_string(),
        description: format!("项目「{}」故事骨架（{}）", project.name, scope_note),
        project: None,
        projects: None,
        script: None,
        scripts: None,
        story_skeleton: Some(skeleton.clone()),
        adaptation_strategy: None,
        error_hint: if skeleton.is_empty() {
            Some("故事骨架尚未填写。".to_string())
        } else {
            None
        },
    })
}

fn query_adaptation_strategy(
    conn: &Connection,
    user_message: &str,
) -> Result<AssistantContextResult, String> {
    let (project, scope_note) = resolve_target_project(conn, user_message)?;
    let work_data = script_store::fetch_script_work_data(conn, &project.id);
    let strategy = work_data.adaptation_strategy.trim().to_string();

    Ok(AssistantContextResult {
        query_kind: "adaptation_strategy".to_string(),
        description: format!("项目「{}」改编策略（{}）", project.name, scope_note),
        project: None,
        projects: None,
        script: None,
        scripts: None,
        story_skeleton: None,
        adaptation_strategy: Some(strategy.clone()),
        error_hint: if strategy.is_empty() {
            Some("改编策略尚未填写。".to_string())
        } else {
            None
        },
    })
}

#[tauri::command]
pub fn query_assistant_context(
    input: QueryAssistantContextInput,
) -> Result<AssistantContextResult, String> {
    let conn = init_db()?;

    match input.query_kind.as_str() {
        "project_list" => query_project_list(&conn),
        "project_detail" => query_project_detail(&conn, &input.user_message),
        "script_episode" => {
            let episode_index = input.episode_index.ok_or_else(|| {
                "缺少 episodeIndex，无法查询指定集数剧本。".to_string()
            })?;
            query_script_episode(&conn, &input.user_message, episode_index)
        }
        "script_list" => query_script_list(&conn, &input.user_message),
        "story_skeleton" => query_story_skeleton(&conn, &input.user_message),
        "adaptation_strategy" => query_adaptation_strategy(&conn, &input.user_message),
        other => Err(format!("不支持的查询类型: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_chars_respects_limit() {
        let (text, truncated) = truncate_chars("abcdef", 3);
        assert_eq!(text, "abc");
        assert!(truncated);
    }
}
