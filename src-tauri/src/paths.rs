use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::{AppHandle, Manager};

#[derive(Clone, Debug)]
pub struct AppPaths {
    pub sqlite_dir: PathBuf,
    pub assets_dir: PathBuf,
    /// Visual manual bundles (`src/prompts/projectCreation/viewManuals`).
    pub view_manuals_dir: PathBuf,
    /// Director manual prompts (`src/prompts/projectCreation/directorManuals`).
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

fn project_creation_prompts_dir(repo: &PathBuf) -> PathBuf {
    repo.join("src")
        .join("prompts")
        .join("projectCreation")
}

fn resolve(handle: &AppHandle) -> Result<AppPaths, String> {
    if let Some(repo) = find_dev_repo_root() {
        let data = repo.join("data");
        let sqlite_dir = data.join("sqlite");
        let assets_dir = data.join("assets");
        let project_creation = project_creation_prompts_dir(&repo);
        let view_manuals_dir = project_creation.join("viewManuals");
        let director_manuals_dir = project_creation.join("directorManuals");
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
            let view_manuals = project_creation_prompts_dir(&repo).join("viewManuals");
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

fn bundled_project_creation_candidates(resource: &PathBuf) -> Vec<PathBuf> {
    vec![
        resource
            .join("_up_")
            .join("src")
            .join("prompts")
            .join("projectCreation"),
        resource.join("src").join("prompts").join("projectCreation"),
        resource.join("projectCreation"),
    ]
}

fn resolve_bundled_view_manuals(handle: &AppHandle) -> Result<PathBuf, String> {
    let resource = handle.path().resource_dir().map_err(|e| e.to_string())?;
    for base in bundled_project_creation_candidates(&resource) {
        let candidate = base.join("viewManuals");
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
    for base in bundled_project_creation_candidates(&resource) {
        let candidate = base.join("directorManuals");
        if candidate.is_dir() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "未找到内置导演手册资源（resource_dir: {}）",
        resource.display()
    ))
}
