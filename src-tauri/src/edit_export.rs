use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineExportClip {
    pub file_path: String,
    pub source_offset_ms: u64,
    pub duration_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTimelineInput {
    pub clips: Vec<TimelineExportClip>,
    pub output_path: String,
}

fn configure_ffmpeg_command(command: &mut Command) {
    command.stdin(Stdio::null());

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
}

fn run_command(command: &mut Command) -> Result<Output, String> {
    configure_ffmpeg_command(command);
    command
        .output()
        .map_err(|error| format!("执行 ffmpeg 失败: {error}"))
}

fn resolve_ffmpeg_command() -> Result<PathBuf, String> {
    let candidates: Vec<PathBuf> = vec![PathBuf::from("ffmpeg")];

    #[cfg(windows)]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPDATA") {
            candidates.push(
                PathBuf::from(local_app_data)
                    .join("Microsoft")
                    .join("WinGet")
                    .join("Links")
                    .join("ffmpeg.exe"),
            );
        }

        if let Ok(program_files) = std::env::var("ProgramFiles") {
            candidates.push(
                PathBuf::from(&program_files)
                    .join("ffmpeg")
                    .join("bin")
                    .join("ffmpeg.exe"),
            );
        }

        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(
                PathBuf::from(&program_files_x86)
                    .join("ffmpeg")
                    .join("bin")
                    .join("ffmpeg.exe"),
            );
        }
    }

    for candidate in candidates {
        let output = run_command(
            Command::new(&candidate)
                .arg("-version"),
        );

        match output {
            Ok(output) if output.status.success() => return Ok(candidate),
            _ => continue,
        }
    }

    Err(
        "未检测到 ffmpeg，请先安装 ffmpeg 后再导出视频（macOS: brew install ffmpeg；Windows: 安装后将 ffmpeg 加入系统 PATH，或放到 C:\\ffmpeg\\bin）"
            .to_string(),
    )
}

fn ensure_ffmpeg() -> Result<PathBuf, String> {
    resolve_ffmpeg_command()
}

fn ms_to_seconds(ms: u64) -> String {
    format!("{:.3}", ms as f64 / 1000.0)
}

fn concat_list_line(path: &Path) -> String {
    let normalized = path
        .to_string_lossy()
        .replace('\\', "/")
        .replace('\'', "'\\''");
    format!("file '{normalized}'")
}

fn run_ffmpeg(ffmpeg: &Path, args: &[&str]) -> Result<(), String> {
    let output = run_command(Command::new(ffmpeg).args(args))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(if stderr.trim().is_empty() {
        "ffmpeg 处理失败".to_string()
    } else {
        stderr.lines().rev().take(4).collect::<Vec<_>>().join("\n")
    })
}

#[tauri::command]
pub fn export_timeline(input: ExportTimelineInput) -> Result<(), String> {
    if input.clips.is_empty() {
        return Err("时间线为空，请先添加视频片段".to_string());
    }

    let output_path = input.output_path.trim();
    if output_path.is_empty() {
        return Err("导出路径不能为空".to_string());
    }

    for clip in &input.clips {
        if clip.duration_ms == 0 {
            return Err("存在时长为 0 的片段".to_string());
        }
        if !Path::new(&clip.file_path).is_file() {
            return Err(format!("视频文件不存在: {}", clip.file_path));
        }
    }

    let ffmpeg = ensure_ffmpeg()?;

    let output = PathBuf::from(output_path);
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建导出目录失败: {error}"))?;
    }

    let temp_dir = std::env::temp_dir().join(format!(
        "textflow-export-{}",
        chrono_like_timestamp()
    ));
    fs::create_dir_all(&temp_dir).map_err(|error| format!("创建临时目录失败: {error}"))?;

    let export_result = (|| {
        let mut segment_paths: Vec<PathBuf> = Vec::new();

        for (index, clip) in input.clips.iter().enumerate() {
            let segment_path = temp_dir.join(format!("segment_{index:03}.mp4"));
            run_ffmpeg(
                &ffmpeg,
                &[
                    "-y",
                    "-ss",
                    &ms_to_seconds(clip.source_offset_ms),
                    "-i",
                    &clip.file_path,
                    "-t",
                    &ms_to_seconds(clip.duration_ms),
                    "-c:v",
                    "libx264",
                    "-preset",
                    "fast",
                    "-crf",
                    "23",
                    "-c:a",
                    "aac",
                    "-movflags",
                    "+faststart",
                    segment_path.to_string_lossy().as_ref(),
                ],
            )?;
            segment_paths.push(segment_path);
        }

        if segment_paths.len() == 1 {
            fs::copy(&segment_paths[0], &output)
                .map_err(|error| format!("写入导出文件失败: {error}"))?;
        } else {
            let list_path = temp_dir.join("concat.txt");
            let list_body = segment_paths
                .iter()
                .map(|path| concat_list_line(path))
                .collect::<Vec<_>>()
                .join("\n");
            fs::write(&list_path, list_body)
                .map_err(|error| format!("写入拼接列表失败: {error}"))?;

            run_ffmpeg(
                &ffmpeg,
                &[
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    list_path.to_string_lossy().as_ref(),
                    "-c",
                    "copy",
                    output.to_string_lossy().as_ref(),
                ],
            )?;
        }

        if !output.is_file() {
            return Err("导出文件未生成，请检查 ffmpeg 是否可用".to_string());
        }

        Ok(())
    })();

    let _ = fs::remove_dir_all(&temp_dir);
    export_result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn concat_list_line_normalizes_windows_paths() {
        let path = Path::new(r"C:\Users\foo\AppData\Local\Temp\segment_000.mp4");
        assert_eq!(
            concat_list_line(path),
            "file 'C:/Users/foo/AppData/Local/Temp/segment_000.mp4'"
        );
    }
}

fn chrono_like_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
