use crate::paths;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillManualItem {
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub cover_path: Option<String>,
}

fn view_manuals_root(_app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(paths::get()?.view_manuals_dir.clone())
}

fn director_manuals_root(_app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(paths::get()?.director_manuals_dir.clone())
}

/// Director manuals enabled in project creation (folder ids under `directorManuals/`).
const ENABLED_DIRECTOR_MANUAL_IDS: &[&str] = &["Mystery_thriller", "Urban_workplace_drama"];

fn parse_md_title(content: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') {
            return normalize_title(trimmed);
        }
    }
    String::new()
}

fn normalize_title(line: &str) -> String {
    line.trim()
        .trim_start_matches('#')
        .trim()
        .replace("--", "")
        .trim()
        .to_string()
}

fn parse_readme(readme_path: &Path) -> (String, String) {
    let content = fs::read_to_string(readme_path).unwrap_or_default();
    let lines: Vec<&str> = content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();

    let name = lines
        .first()
        .map(|line| normalize_title(line))
        .unwrap_or_default();
    let subtitle = lines
        .get(1)
        .map(|line| normalize_title(line))
        .unwrap_or_default();

    (name, subtitle)
}

fn find_cover_image(skill_dir: &Path) -> Option<String> {
    let images_dir = skill_dir.join("images");
    if !images_dir.is_dir() {
        return None;
    }

    let preferred = images_dir.join("title.png");
    if preferred.is_file() {
        return preferred.to_str().map(str::to_string);
    }

    let mut files: Vec<PathBuf> = fs::read_dir(&images_dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .is_some_and(|ext| {
                        matches!(
                            ext.to_ascii_lowercase().as_str(),
                            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg"
                        )
                    })
        })
        .collect();

    files.sort();
    files.first()?.to_str().map(str::to_string)
}

fn list_skill_dir(app: &tauri::AppHandle, dir: PathBuf) -> Result<Vec<SkillManualItem>, String> {
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .collect();

    entries.sort_by_key(|entry| entry.file_name());

    let items = entries
        .into_iter()
        .filter_map(|entry| {
            let path = entry.path();
            let id = entry.file_name().to_str()?.to_string();
            let readme_path = path.join("README.md");
            let (name, subtitle) = if readme_path.is_file() {
                parse_readme(&readme_path)
            } else {
                (id.clone(), String::new())
            };

            Some(SkillManualItem {
                id,
                name,
                subtitle,
                cover_path: find_cover_image(&path),
            })
        })
        .collect();

    Ok(items)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillTab {
    pub label: String,
    pub value: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDetail {
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub cover_path: Option<String>,
    pub image_paths: Vec<String>,
    pub tabs: Vec<SkillTab>,
}

struct TabDef {
    label: &'static str,
    value: &'static str,
    sub_dir: Option<&'static str>,
}

const ART_TABS: &[TabDef] = &[
    TabDef {
        label: "README",
        value: "README",
        sub_dir: None,
    },
    TabDef {
        label: "前缀",
        value: "prefix",
        sub_dir: None,
    },
    TabDef {
        label: "角色",
        value: "art_character",
        sub_dir: Some("art_prompt"),
    },
    TabDef {
        label: "角色衍生",
        value: "art_character_derivative",
        sub_dir: Some("art_prompt"),
    },
    TabDef {
        label: "道具",
        value: "art_prop",
        sub_dir: Some("art_prompt"),
    },
    TabDef {
        label: "道具衍生",
        value: "art_prop_derivative",
        sub_dir: Some("art_prompt"),
    },
    TabDef {
        label: "场景",
        value: "art_scene",
        sub_dir: Some("art_prompt"),
    },
    TabDef {
        label: "场景衍生",
        value: "art_scene_derivative",
        sub_dir: Some("art_prompt"),
    },
    TabDef {
        label: "分镜",
        value: "director_storyboard",
        sub_dir: Some("driector_skills"),
    },
    TabDef {
        label: "分镜视频",
        value: "art_storyboard_video",
        sub_dir: Some("art_prompt"),
    },
    TabDef {
        label: "技法-导演规划",
        value: "director_planning_style",
        sub_dir: Some("driector_skills"),
    },
    TabDef {
        label: "技法-分镜表设计",
        value: "director_storyboard_table_style",
        sub_dir: Some("driector_skills"),
    },
];

const STORY_TABS: &[TabDef] = &[
    TabDef {
        label: "README",
        value: "README",
        sub_dir: None,
    },
    TabDef {
        label: "导演规划",
        value: "director_planning_narrative",
        sub_dir: Some("driector_skills"),
    },
    TabDef {
        label: "分镜表",
        value: "director_storyboard_table_narrative",
        sub_dir: Some("driector_skills"),
    },
];

fn read_md_file(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_default()
}

fn tab_file_path(skill_dir: &Path, tab: &TabDef) -> PathBuf {
    if tab.value == "README" {
        return skill_dir.join("README.md");
    }

    match tab.sub_dir {
        Some(sub_dir) => skill_dir.join(sub_dir).join(format!("{}.md", tab.value)),
        None => skill_dir.join(format!("{}.md", tab.value)),
    }
}

fn list_skill_images(skill_dir: &Path) -> Vec<String> {
    let images_dir = skill_dir.join("images");
    if !images_dir.is_dir() {
        return Vec::new();
    }

    let mut files: Vec<PathBuf> = fs::read_dir(&images_dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .is_some_and(|ext| {
                        matches!(
                            ext.to_ascii_lowercase().as_str(),
                            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg"
                        )
                    })
        })
        .collect();

    files.sort();
    files
        .into_iter()
        .filter_map(|path| path.to_str().map(str::to_string))
        .collect()
}

fn get_skill_detail(
    app: &tauri::AppHandle,
    base_dir: PathBuf,
    id: &str,
    tabs: &[TabDef],
) -> Result<SkillDetail, String> {
    if id.contains('/') || id.contains('\\') || id == "." || id == ".." {
        return Err("无效的手册 ID".to_string());
    }

    let skill_dir = base_dir.join(id);
    if !skill_dir.is_dir() {
        return Err(format!("手册不存在: {id}"));
    }

    let readme_path = skill_dir.join("README.md");
    let (name, subtitle) = if readme_path.is_file() {
        parse_readme(&readme_path)
    } else {
        (id.to_string(), String::new())
    };

    let tab_items = tabs
        .iter()
        .map(|tab| SkillTab {
            label: tab.label.to_string(),
            value: tab.value.to_string(),
            content: read_md_file(&tab_file_path(&skill_dir, tab)),
        })
        .collect();

    Ok(SkillDetail {
        id: id.to_string(),
        name,
        subtitle,
        cover_path: find_cover_image(&skill_dir),
        image_paths: list_skill_images(&skill_dir),
        tabs: tab_items,
    })
}

#[tauri::command]
pub fn get_art_skill_detail(app: tauri::AppHandle, id: String) -> Result<SkillDetail, String> {
    get_skill_detail(&app, view_manuals_root(&app)?, &id, ART_TABS)
}

#[tauri::command]
pub fn get_story_skill_detail(app: tauri::AppHandle, id: String) -> Result<SkillDetail, String> {
    get_skill_detail(
        &app,
        view_manuals_root(&app)?.join("story_skills"),
        &id,
        STORY_TABS,
    )
}

#[tauri::command]
pub fn list_art_skills(app: tauri::AppHandle) -> Result<Vec<SkillManualItem>, String> {
    list_skill_dir(&app, view_manuals_root(&app)?)
}

#[tauri::command]
pub fn list_story_skills(app: tauri::AppHandle) -> Result<Vec<SkillManualItem>, String> {
    list_skill_dir(&app, view_manuals_root(&app)?.join("story_skills"))
}

#[tauri::command]
pub fn list_director_manuals(app: tauri::AppHandle) -> Result<Vec<SkillManualItem>, String> {
    let items = list_skill_dir(&app, director_manuals_root(&app)?)?;
    Ok(items
        .into_iter()
        .filter(|item| ENABLED_DIRECTOR_MANUAL_IDS.contains(&item.id.as_str()))
        .collect())
}

#[tauri::command]
pub fn get_director_manual_detail(
    app: tauri::AppHandle,
    id: String,
) -> Result<SkillDetail, String> {
    if !ENABLED_DIRECTOR_MANUAL_IDS.contains(&id.as_str()) {
        return Err(format!("导演手册不存在: {id}"));
    }
    get_skill_detail(&app, director_manuals_root(&app)?, &id, STORY_TABS)
}

#[tauri::command]
pub fn get_director_manual(app: tauri::AppHandle, id: String) -> Result<String, String> {
    if id.contains('/') || id.contains('\\') || id == "." || id == ".." {
        return Err("无效的导演手册 ID".to_string());
    }

    let detail = get_director_manual_detail(app, id)?;
    let parts = detail
        .tabs
        .into_iter()
        .filter(|tab| !tab.content.trim().is_empty())
        .map(|tab| format!("## {}\n\n{}", tab.label, tab.content.trim()))
        .collect::<Vec<_>>();

    if parts.is_empty() {
        return Err("导演手册内容为空".to_string());
    }

    Ok(parts.join("\n\n"))
}
