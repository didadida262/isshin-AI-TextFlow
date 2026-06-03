fn rerun_if_icons_changed(dir: &std::path::Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            rerun_if_icons_changed(&path);
            continue;
        }
        println!("cargo:rerun-if-changed={}", path.display());
    }
}

fn main() {
    rerun_if_icons_changed(std::path::Path::new("icons"));
    tauri_build::build()
}
