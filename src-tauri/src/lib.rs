mod edit_export;
mod image;
mod video;
mod assistant_context;
mod assets;
mod db;
mod db_admin;
mod llm;
mod novel;
mod paths;
mod projects;
mod script;
mod skills;
mod workflow;

use edit_export::{export_timeline, extract_audio_waveform};
use assistant_context::query_assistant_context;
use image::generate_image;
use video::{generate_image_to_video, generate_video};
use assets::{
    create_project_asset, delete_project_asset, list_project_assets, regenerate_project_asset,
    update_project_asset,
};
use db::login;
use db_admin::{
    clear_database, clear_database_table, export_database, export_database_to_file,
    copy_file, get_database_overview, import_database, write_base64_file,
};
use llm::{llm_chat_completion, llm_log_inbound, llm_log_outbound};
use novel::{
    begin_event_extraction, clear_novel_event_extraction, end_event_extraction_in_progress,
    get_novel_source, import_novel, list_novel_chapters, set_event_extraction_duration,
    update_novel_chapter_event,
};
use projects::{create_project, delete_project, list_projects, update_project};
use skills::{
    get_art_skill_detail, get_director_manual, get_director_manual_detail,
    get_story_skill_detail, list_art_skills, list_director_manuals, list_story_skills,
};
use script::{
    get_script_work_data, list_scripts, set_script_video_prompt, set_script_work_data,
    upsert_script,
};
use workflow::{
    get_project_workflow_node_detail, list_project_workflow_nodes,
};
use tauri::Manager;

fn apply_app_icon(app: &tauri::App) {
    let Ok(image) = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png")) else {
        return;
    };

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_icon(image);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            paths::install(app.handle()).map_err(|error| {
                eprintln!("[isshin-ai-textflow] 路径初始化失败: {error}");
                error
            })?;
            db::init_db().map_err(|error| {
                eprintln!("[isshin-ai-textflow] 数据库初始化失败: {error}");
                error
            })?;
            apply_app_icon(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            create_project,
            list_projects,
            update_project,
            delete_project,
            query_assistant_context,
            list_art_skills,
            list_story_skills,
            list_director_manuals,
            get_art_skill_detail,
            get_story_skill_detail,
            get_director_manual,
            get_director_manual_detail,
            llm_chat_completion,
            llm_log_outbound,
            llm_log_inbound,
            import_novel,
            clear_novel_event_extraction,
            begin_event_extraction,
            end_event_extraction_in_progress,
            get_novel_source,
            list_novel_chapters,
            set_event_extraction_duration,
            update_novel_chapter_event,
            get_script_work_data,
            set_script_work_data,
            list_scripts,
            upsert_script,
            set_script_video_prompt,
            list_project_workflow_nodes,
            get_project_workflow_node_detail,
            list_project_assets,
            create_project_asset,
            update_project_asset,
            regenerate_project_asset,
            delete_project_asset,
            generate_image,
            generate_video,
            generate_image_to_video,
            export_timeline,
            extract_audio_waveform,
            get_database_overview,
            export_database,
            export_database_to_file,
            copy_file,
            write_base64_file,
            import_database,
            clear_database_table,
            clear_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
