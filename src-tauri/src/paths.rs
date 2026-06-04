use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::{AppHandle, Manager};

#[derive(Clone, Debug)]
pub struct AppPaths {
    pub sqlite_dir: PathBuf,
    pub assets_dir: PathBuf,
    pub skills_dir: PathBuf,
}

static APP_PATHS: OnceLock<AppPaths> = OnceLock::new();

pub fn install(handle: &AppHandle) -> Result<(), String> {
    let paths = resolve(handle)?;
    APP_PATHS
        .set(paths)
        .map_err(|_| "应用路径已初始化".to_string())
}

pub fn get() -> Result<&'static AppPaths, String> {
    APP_PATHS
        .get()
        .ok_or_else(|| "应用路径未初始化".to_string())
}

fn resolve(handle: &AppHandle) -> Result<AppPaths, String> {
    if let Some(data) = find_dev_data_root() {
        let sqlite_dir = data.join("sqlite");
        let assets_dir = data.join("assets");
        let skills_dir = data.join("skills");
        std::fs::create_dir_all(&sqlite_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
        if !skills_dir.is_dir() {
            return Err(format!("未找到 skills 目录: {}", skills_dir.display()));
        }
        return Ok(AppPaths {
            sqlite_dir,
            assets_dir,
            skills_dir,
        });
    }

    let app_data = handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let sqlite_dir = app_data.join("sqlite");
    let assets_dir = app_data.join("assets");
    std::fs::create_dir_all(&sqlite_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let skills_dir = resolve_bundled_skills(handle)?;

    Ok(AppPaths {
        sqlite_dir,
        assets_dir,
        skills_dir,
    })
}

/// Walk upward from cwd / executable to find repo `data/` (local dev only).
fn find_dev_data_root() -> Option<PathBuf> {
    let mut starts = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        starts.push(cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            starts.push(parent.to_path_buf());
        }
    }

    for start in starts {
        if let Some(data) = walk_up_for_data_dir(start) {
            if data.join("skills").is_dir() {
                return Some(data);
            }
        }
    }
    None
}

fn walk_up_for_data_dir(mut start: PathBuf) -> Option<PathBuf> {
    for _ in 0..12 {
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

fn resolve_bundled_skills(handle: &AppHandle) -> Result<PathBuf, String> {
    let resource = handle.path().resource_dir().map_err(|e| e.to_string())?;
    for candidate in [
        resource.join("_up_").join("data").join("skills"),
        resource.join("data").join("skills"),
        resource.join("skills"),
    ] {
        if candidate.is_dir() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "未找到内置 skills 资源（resource_dir: {}）",
        resource.display()
    ))
}
