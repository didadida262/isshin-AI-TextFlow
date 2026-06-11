use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::{AppHandle, Manager};

#[derive(Clone, Debug)]
pub struct AppPaths {
    pub sqlite_dir: PathBuf,
    pub assets_dir: PathBuf,
    /// Visual manual bundles (`src/prompts/viewManuals`).
    pub view_manuals_dir: PathBuf,
    /// Director manual prompts (`src/prompts/directorManuals`).
    pub director_manuals_dir: PathBuf,
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
    if let Some(repo) = find_dev_repo_root() {
        let data = repo.join("data");
        let sqlite_dir = data.join("sqlite");
        let assets_dir = data.join("assets");
        let view_manuals_dir = repo.join("src").join("prompts").join("viewManuals");
        let director_manuals_dir = repo.join("src").join("prompts").join("directorManuals");
        std::fs::create_dir_all(&sqlite_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
        if !view_manuals_dir.is_dir() {
            return Err(format!(
                "未找到视觉手册目录: {}",
                view_manuals_dir.display()
            ));
        }
        if !director_manuals_dir.is_dir() {
            return Err(format!(
                "未找到导演手册目录: {}",
                director_manuals_dir.display()
            ));
        }
        return Ok(AppPaths {
            sqlite_dir,
            assets_dir,
            view_manuals_dir,
            director_manuals_dir,
        });
    }

    let app_data = handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let sqlite_dir = app_data.join("sqlite");
    let assets_dir = app_data.join("assets");
    std::fs::create_dir_all(&sqlite_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let view_manuals_dir = resolve_bundled_view_manuals(handle)?;
    let director_manuals_dir = resolve_bundled_director_manuals(handle)?;

    Ok(AppPaths {
        sqlite_dir,
        assets_dir,
        view_manuals_dir,
        director_manuals_dir,
    })
}

fn find_dev_repo_root() -> Option<PathBuf> {
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
        if let Some(repo) = walk_up_for_repo_root(start) {
            let view_manuals = repo.join("src").join("prompts").join("viewManuals");
            if view_manuals.is_dir() {
                return repo.canonicalize().ok().or(Some(repo));
            }
        }
    }
    None
}

fn walk_up_for_repo_root(mut start: PathBuf) -> Option<PathBuf> {
    for _ in 0..12 {
        if start.join("src-tauri").join("Cargo.toml").is_file()
            && start.join("package.json").is_file()
        {
            return start.canonicalize().ok().or(Some(start));
        }
        if !start.pop() {
            break;
        }
    }
    None
}

fn resolve_bundled_view_manuals(handle: &AppHandle) -> Result<PathBuf, String> {
    let resource = handle.path().resource_dir().map_err(|e| e.to_string())?;
    for candidate in [
        resource.join("_up_").join("src").join("prompts").join("viewManuals"),
        resource.join("src").join("prompts").join("viewManuals"),
        resource.join("viewManuals"),
    ] {
        if candidate.is_dir() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "未找到内置视觉手册资源（resource_dir: {}）",
        resource.display()
    ))
}

fn resolve_bundled_director_manuals(handle: &AppHandle) -> Result<PathBuf, String> {
    let resource = handle.path().resource_dir().map_err(|e| e.to_string())?;
    for candidate in [
        resource.join("_up_").join("src").join("prompts").join("directorManuals"),
        resource.join("src").join("prompts").join("directorManuals"),
        resource.join("directorManuals"),
    ] {
        if candidate.is_dir() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "未找到内置导演手册资源（resource_dir: {}）",
        resource.display()
    ))
}
