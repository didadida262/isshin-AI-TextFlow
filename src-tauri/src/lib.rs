mod db;
mod llm;
mod novel;
mod projects;
mod skills;
mod workflow;

use db::login;
use llm::{llm_chat_completion, llm_log_inbound, llm_log_outbound};
use novel::{
    get_novel_source, import_novel, list_novel_chapters, update_novel_chapter_event,
};
use projects::{create_project, list_projects, update_project};
use serde::Serialize;
use skills::{get_art_skill_detail, get_story_skill_detail, list_art_skills, list_story_skills};
use workflow::{
    get_project_workflow_node_detail, list_project_workflow_nodes,
};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileReadResult {
    pub filename: String,
    pub content: String,
    pub path: String,
}

fn project_root() -> PathBuf {
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[tauri::command]
fn read_project_file(filename: String) -> Result<FileReadResult, String> {
    let allowed = ["package.json", ".gitignore"];
    if !allowed.contains(&filename.as_str()) {
        return Err(format!("不允许读取的文件: {filename}"));
    }

    let root = project_root();
    let file_path = root.join(&filename);

    if !file_path.exists() {
        return Err(format!("文件不存在: {}", file_path.display()));
    }

    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

    Ok(FileReadResult {
        filename: filename.clone(),
        content,
        path: file_path.display().to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .setup(|_| {
            db::init_db().expect("failed to init database");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            create_project,
            list_projects,
            update_project,
            read_project_file,
            list_art_skills,
            list_story_skills,
            get_art_skill_detail,
            get_story_skill_detail,
            llm_chat_completion,
            llm_log_outbound,
            llm_log_inbound,
            import_novel,
            get_novel_source,
            list_novel_chapters,
            update_novel_chapter_event,
            list_project_workflow_nodes,
            get_project_workflow_node_detail
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
