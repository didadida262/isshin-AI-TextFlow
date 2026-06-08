use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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

fn ensure_ffmpeg() -> Result<(), String> {
    let output = Command::new("ffmpeg")
        .arg("-version")
        .output()
        .map_err(|_| {
            "未检测到 ffmpeg，请先安装 ffmpeg 后再导出视频（macOS: brew install ffmpeg）".to_string()
        })?;
    if !output.status.success() {
        return Err("ffmpeg 不可用，请检查安装".to_string());
    }
    Ok(())
}

fn ms_to_seconds(ms: u64) -> String {
    format!("{:.3}", ms as f64 / 1000.0)
}

fn run_ffmpeg(args: &[&str]) -> Result<(), String> {
    let output = Command::new("ffmpeg")
        .args(args)
        .output()
        .map_err(|error| format!("执行 ffmpeg 失败: {error}"))?;

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

    ensure_ffmpeg()?;

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
            run_ffmpeg(&[
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
            ])?;
            segment_paths.push(segment_path);
        }

        if segment_paths.len() == 1 {
            fs::copy(&segment_paths[0], &output)
                .map_err(|error| format!("写入导出文件失败: {error}"))?;
            return Ok(());
        }

        let list_path = temp_dir.join("concat.txt");
        let list_body = segment_paths
            .iter()
            .map(|path| format!("file '{}'", path.to_string_lossy().replace('\'', "'\\''")))
            .collect::<Vec<_>>()
            .join("\n");
        fs::write(&list_path, list_body).map_err(|error| format!("写入拼接列表失败: {error}"))?;

        run_ffmpeg(&[
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
        ])
    })();

    let _ = fs::remove_dir_all(&temp_dir);
    export_result
}

fn chrono_like_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
