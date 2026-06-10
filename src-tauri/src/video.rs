use base64::Engine;
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::time::sleep;

const DEFAULT_VIDEO_API_URL: &str = "http://27.159.92.210:8081/v1/videos/sync";
const DEFAULT_VIDEO_API_KEY: &str = "wan2.2-ti2v-5b@srd*OB6sgdessj8YTF8HBVGhIYTgd76sfR";
const DEFAULT_IMAGE_TO_VIDEO_API_URL: &str = "http://27.159.92.210:8081/v1/videos/sync";
const DEFAULT_IMAGE_TO_VIDEO_API_KEY: &str =
    "wan2.2-ti2v-5b@srd*OB6sgdessj8YTF8HBVGhIYTgd76sfR";
const DEFAULT_IMAGE_TO_VIDEO_NEGATIVE_PROMPT: &str = "low quality, blurry, static";
const DEFAULT_IMAGE_TO_VIDEO_GUIDANCE_SCALE: f64 = 1.0;
const DEFAULT_IMAGE_TO_VIDEO_GUIDANCE_SCALE_2: f64 = 1.0;
const DEFAULT_IMAGE_TO_VIDEO_FLOW_SHIFT: f64 = 12.0;
const DEFAULT_VIDEO_SIZE: &str = "832x480";
const DEFAULT_NUM_FRAMES: u32 = 160;
const DEFAULT_FPS: u32 = 16;
const DEFAULT_NUM_INFERENCE_STEPS: u32 = 40;
const DEFAULT_GUIDANCE_SCALE: f64 = 4.0;
const DEFAULT_GUIDANCE_SCALE_2: f64 = 4.0;
const DEFAULT_BOUNDARY_RATIO: f64 = 0.875;
const DEFAULT_FLOW_SHIFT: f64 = 5.0;
const DEFAULT_SEED: i64 = 42;

const KUAIZI_DEFAULT_CREATE_URL: &str =
    "https://aiopenapi.kuaizi.cn/ai-open-platform-api/v1/lz/video/task/create";
const KUAIZI_DEFAULT_MODE: &str = "fast";
const KUAIZI_DEFAULT_RESOLUTION: &str = "720p";
const KUAIZI_DEFAULT_RATIO: &str = "16:9";
const KUAIZI_DEFAULT_DURATION: u32 = 5;
const KUAIZI_DEFAULT_GENERATION_TYPE: &str = "video";
const KUAIZI_POLL_INTERVAL_SECS: u64 = 5;
const KUAIZI_POLL_TIMEOUT_SECS: u64 = 600;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateVideoInput {
    pub prompt: String,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    pub size: Option<String>,
    pub num_frames: Option<u32>,
    pub fps: Option<u32>,
    pub num_inference_steps: Option<u32>,
    pub guidance_scale: Option<f64>,
    pub guidance_scale_2: Option<f64>,
    pub boundary_ratio: Option<f64>,
    pub flow_shift: Option<f64>,
    pub seed: Option<i64>,
    pub mode: Option<String>,
    pub resolution: Option<String>,
    pub ratio: Option<String>,
    pub duration: Option<u32>,
    pub generation_type: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateVideoResult {
    pub video_b64: String,
}

#[derive(Debug, Serialize)]
struct KuaiziCreateRequest {
    prompt: String,
    mode: String,
    resolution: String,
    ratio: String,
    duration: u32,
    generation_type: String,
}

#[derive(Debug, Serialize)]
struct KuaiziStatusRequest<'a> {
    task_id: &'a str,
}

fn map_request_error(error: &reqwest::Error, url: &str) -> String {
    if error.is_connect() || error.is_timeout() {
        return format!(
            "无法连接视频服务（{url}），请确认本地视频 API 已启动。测试命令：curl {url}"
        );
    }
    format!("视频生成请求失败: {error}")
}

fn format_f64(value: f64) -> String {
    let text = format!("{value}");
    if text.contains('.') {
        text.trim_end_matches('0').trim_end_matches('.').to_string()
    } else {
        text
    }
}

fn is_kuaizi_video_api(url: &str) -> bool {
    let trimmed = url.trim();
    trimmed.starts_with("https://aiopenapi.kuaizi.cn")
        || trimmed.contains("kuaizi.cn")
        || trimmed.contains("/lz/video/task/")
}

fn resolve_kuaizi_text_field<'a>(value: Option<&'a str>, fallback: &'a str) -> &'a str {
    value
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .unwrap_or(fallback)
}

fn normalize_kuaizi_create_url(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return KUAIZI_DEFAULT_CREATE_URL.to_string();
    }
    if trimmed.contains("/task/create") {
        return trimmed.to_string();
    }
    if trimmed.contains("kuaizi.cn") {
        let base = trimmed.trim_end_matches('/');
        if base.ends_with("/ai-open-platform-api") {
            return format!("{base}/v1/lz/video/task/create");
        }
        if base.ends_with("/v1/lz/video/task") {
            return format!("{base}/create");
        }
        return format!("{base}/ai-open-platform-api/v1/lz/video/task/create");
    }
    trimmed.to_string()
}

fn kuaizi_status_url(create_url: &str) -> String {
    if create_url.contains("/task/create") {
        create_url.replace("/task/create", "/task/status")
    } else {
        format!(
            "{}/status",
            create_url.trim_end_matches('/').trim_end_matches("/create")
        )
    }
}

async fn read_response_json(
    response: reqwest::Response,
    action: &str,
) -> Result<(reqwest::StatusCode, serde_json::Value), String> {
    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("读取筷子{action}响应失败: {error}"))?;
    let text = String::from_utf8_lossy(&bytes);
    serde_json::from_str(&text).map_err(|error| {
        let preview: String = text.chars().take(240).collect();
        format!("解析筷子{action}响应失败: {error}（HTTP {}）: {preview}", status.as_u16())
    }).map(|json| (status, json))
}

fn gcd(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        let remainder = a % b;
        a = b;
        b = remainder;
    }
    a
}

fn ratio_from_dimensions(width: u32, height: u32) -> String {
    let divisor = gcd(width, height);
    format!("{}:{}", width / divisor, height / divisor)
}

fn map_size_to_kuaizi_params(size: &str, num_frames: u32, fps: u32) -> (String, String, u32) {
    let duration = ((num_frames as f64 / fps as f64).round() as u32).clamp(3, 15);

    if let Some((width, height)) = size.split_once('x').and_then(|(w, h)| {
        Some((w.parse::<u32>().ok()?, h.parse::<u32>().ok()?))
    }) {
        let resolution = if height >= 1080 {
            "1080p".to_string()
        } else if height >= 720 {
            "720p".to_string()
        } else {
            "480p".to_string()
        };
        return (resolution, ratio_from_dimensions(width, height), duration);
    }

    ("720p".to_string(), "16:9".to_string(), duration.max(5))
}

fn json_string_at<'a>(value: &'a serde_json::Value, paths: &[&str]) -> Option<&'a str> {
    paths
        .iter()
        .find_map(|path| value.pointer(path).and_then(|item| item.as_str()))
}

fn parse_kuaizi_task_id(value: &serde_json::Value) -> Option<String> {
    json_string_at(
        value,
        &[
            "/data/task_id",
            "/data/taskId",
            "/data/id",
            "/task_id",
            "/taskId",
            "/id",
        ],
    )
    .map(str::to_string)
}

fn parse_kuaizi_status(value: &serde_json::Value) -> Option<String> {
    json_string_at(
        value,
        &[
            "/data/status",
            "/data/task_status",
            "/data/taskStatus",
            "/data/state",
            "/status",
            "/task_status",
            "/taskStatus",
        ],
    )
    .map(str::to_string)
}

fn parse_kuaizi_video_url(value: &serde_json::Value) -> Option<String> {
    json_string_at(
        value,
        &[
            "/data/video_url",
            "/data/videoUrl",
            "/data/result/video_url",
            "/data/result/videoUrl",
            "/data/output/video_url",
            "/data/output_url",
            "/data/content/video_url",
            "/data/content/videoUrl",
            "/video_url",
            "/videoUrl",
            "/result/video_url",
            "/content/video_url",
            "/content/videoUrl",
        ],
    )
    .map(str::to_string)
}

fn parse_kuaizi_error_message(value: &serde_json::Value, status: u16) -> String {
    if let Some(code) = value.get("code") {
        let is_success = match code {
            serde_json::Value::Number(number) => {
                number.as_i64().is_some_and(|value| value == 0 || value == 200)
            }
            serde_json::Value::String(text) => {
                matches!(text.to_ascii_lowercase().as_str(), "0" | "200" | "success")
            }
            _ => false,
        };
        if !is_success {
            if let Some(message) = json_string_at(value, &["/message", "/msg", "/data/message"]) {
                if !message.trim().is_empty() {
                    return message.to_string();
                }
            }
        }
    }

    if let Some(message) = json_string_at(
        value,
        &[
            "/message",
            "/msg",
            "/data/message",
            "/data/error/message",
            "/error/message",
            "/data/fail_reason",
            "/data/error",
            "/error",
        ],
    ) {
        if !message.trim().is_empty() {
            return message.to_string();
        }
    }
    format!("视频生成失败（HTTP {status}）")
}

fn is_kuaizi_api_success(value: &serde_json::Value, http_status: reqwest::StatusCode) -> bool {
    if !http_status.is_success() {
        return false;
    }
    match value.get("code") {
        None => true,
        Some(code) => match code {
            serde_json::Value::Number(number) => {
                number.as_i64().is_none_or(|value| value == 0 || value == 200)
            }
            serde_json::Value::String(text) => {
                matches!(text.to_ascii_lowercase().as_str(), "0" | "200" | "success")
            }
            _ => false,
        },
    }
}

fn normalize_kuaizi_status(status: &str) -> String {
    match status.trim() {
        "运行中" | "处理中" | "排队中" | "生成中" => "running".to_string(),
        "成功" | "已完成" | "完成" => "success".to_string(),
        "失败" | "已失败" => "failed".to_string(),
        other => other.to_ascii_lowercase(),
    }
}

fn is_kuaizi_terminal_failure(status: &str) -> bool {
    matches!(
        normalize_kuaizi_status(status).as_str(),
        "failed" | "failure" | "error" | "cancelled" | "canceled"
    )
}

fn is_kuaizi_terminal_success(status: &str) -> bool {
    matches!(
        normalize_kuaizi_status(status).as_str(),
        "success" | "succeeded" | "completed" | "complete" | "done"
    )
}

fn is_kuaizi_running_status(status: &str) -> bool {
    matches!(
        normalize_kuaizi_status(status).as_str(),
        "running" | "pending" | "processing" | "queueing" | "queued" | "submitted" | "unknown"
    )
}

async fn generate_video_kuaizi(
    client: &reqwest::Client,
    prompt: &str,
    create_url: &str,
    api_key: &str,
    mode: &str,
    resolution: &str,
    ratio: &str,
    duration: u32,
    generation_type: &str,
) -> Result<GenerateVideoResult, String> {
    let create_url = normalize_kuaizi_create_url(create_url);
    let status_url = kuaizi_status_url(&create_url);

    let request_body = KuaiziCreateRequest {
        prompt: prompt.to_string(),
        mode: mode.to_string(),
        resolution: resolution.to_string(),
        ratio: ratio.to_string(),
        duration: duration.max(1),
        generation_type: generation_type.to_string(),
    };

    println!(
        "[Video/Kuaizi] 创建任务 → {create_url} mode={} resolution={} ratio={} duration={} generation_type={}",
        request_body.mode,
        request_body.resolution,
        request_body.ratio,
        request_body.duration,
        request_body.generation_type
    );

    let create_response = client
        .post(&create_url)
        .header("Content-Type", "application/json")
        .header("ApiKey", api_key.trim())
        .json(&request_body)
        .send()
        .await
        .map_err(|error| map_request_error(&error, &create_url))?;

    let (create_status, create_json) =
        read_response_json(create_response, "创建任务").await?;

    if !is_kuaizi_api_success(&create_json, create_status) {
        return Err(parse_kuaizi_error_message(&create_json, create_status.as_u16()));
    }

    let task_id = parse_kuaizi_task_id(&create_json).ok_or_else(|| {
        format!(
            "筷子 API 未返回 task_id: {}",
            create_json.to_string()
        )
    })?;

    println!("[Video/Kuaizi] 任务已创建 task_id={task_id}");

    let started_at = Instant::now();
    loop {
        if started_at.elapsed() >= Duration::from_secs(KUAIZI_POLL_TIMEOUT_SECS) {
            return Err(format!(
                "筷子视频生成超时（超过 {} 秒）",
                KUAIZI_POLL_TIMEOUT_SECS
            ));
        }

        sleep(Duration::from_secs(KUAIZI_POLL_INTERVAL_SECS)).await;

        let status_request = KuaiziStatusRequest {
            task_id: task_id.as_str(),
        };
        let status_response = client
            .post(&status_url)
            .header("Content-Type", "application/json")
            .header("ApiKey", api_key.trim())
            .json(&status_request)
            .send()
            .await
            .map_err(|error| map_request_error(&error, &status_url))?;

        let (http_status, status_json) =
            read_response_json(status_response, "任务状态").await?;

        if !is_kuaizi_api_success(&status_json, http_status) {
            return Err(parse_kuaizi_error_message(
                &status_json,
                http_status.as_u16(),
            ));
        }

        let status = parse_kuaizi_status(&status_json)
            .map(|value| normalize_kuaizi_status(&value))
            .unwrap_or_else(|| "unknown".to_string());
        println!("[Video/Kuaizi] 查询任务 task_id={task_id} status={status}");

        if is_kuaizi_terminal_failure(&status) {
            return Err(parse_kuaizi_error_message(&status_json, http_status.as_u16()));
        }

        if let Some(video_url) = parse_kuaizi_video_url(&status_json) {
            if is_kuaizi_terminal_success(&status) || !video_url.trim().is_empty() {
                println!("[Video/Kuaizi] 下载视频 → {video_url}");
                let video_response = client
                    .get(video_url)
                    .send()
                    .await
                    .map_err(|error| format!("下载筷子视频失败: {error}"))?;

                let download_status = video_response.status();
                let bytes = video_response
                    .bytes()
                    .await
                    .map_err(|error| format!("读取筷子视频数据失败: {error}"))?;

                if !download_status.is_success() {
                    let text = String::from_utf8_lossy(&bytes);
                    return Err(format!("下载筷子视频失败（HTTP {}）: {text}", download_status.as_u16()));
                }

                if bytes.is_empty() {
                    return Err("筷子视频下载地址未返回视频数据".to_string());
                }

                println!("[Video/Kuaizi] 完成 ← bytes={}", bytes.len());
                return Ok(GenerateVideoResult {
                    video_b64: base64::engine::general_purpose::STANDARD.encode(bytes),
                });
            }
        }

        if is_kuaizi_terminal_success(&status) {
            return Err(format!(
                "筷子任务已完成但未返回 video_url: {}",
                status_json.to_string()
            ));
        }

        if !is_kuaizi_running_status(&status) {
            println!("[Video/Kuaizi] 未识别状态 {status}，继续轮询");
        }
    }
}

async fn generate_video_wan_sync(
    client: &reqwest::Client,
    prompt: &str,
    url: &str,
    api_key: &str,
    size: &str,
    num_frames: u32,
    fps: u32,
    num_inference_steps: u32,
    guidance_scale: f64,
    guidance_scale_2: f64,
    boundary_ratio: f64,
    flow_shift: f64,
    seed: i64,
) -> Result<GenerateVideoResult, String> {
    println!(
        "[Video/Wan] 发送 → {url} size={size} frames={num_frames} fps={fps} steps={num_inference_steps}"
    );

    let form = Form::new()
        .text("prompt", prompt.to_string())
        .text("size", size.to_string())
        .text("num_frames", num_frames.to_string())
        .text("fps", fps.to_string())
        .text("num_inference_steps", num_inference_steps.to_string())
        .text("guidance_scale", format_f64(guidance_scale))
        .text("guidance_scale_2", format_f64(guidance_scale_2))
        .text("boundary_ratio", format_f64(boundary_ratio))
        .text("flow_shift", format_f64(flow_shift))
        .text("seed", seed.to_string());

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key.trim()))
        .multipart(form)
        .send()
        .await
        .map_err(|error| map_request_error(&error, url))?;

    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("读取视频服务响应失败: {error}"))?;

    println!(
        "[Video/Wan] 接收 ← HTTP {} content-type={} bytes={}",
        status.as_u16(),
        content_type,
        bytes.len()
    );

    if !status.is_success() {
        let text = String::from_utf8_lossy(&bytes);
        return Err(parse_error_message(&text, status.as_u16()));
    }

    if bytes.is_empty() {
        return Err("视频服务未返回视频数据".to_string());
    }

    Ok(GenerateVideoResult {
        video_b64: base64::engine::general_purpose::STANDARD.encode(bytes),
    })
}

#[tauri::command]
pub async fn generate_video(input: GenerateVideoInput) -> Result<GenerateVideoResult, String> {
    let prompt = input.prompt.trim();
    if prompt.is_empty() {
        return Err("提示词不能为空".to_string());
    }

    let url = input
        .api_url
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_VIDEO_API_URL.to_string());
    let api_key = input
        .api_key
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_VIDEO_API_KEY.to_string());
    let size = input
        .size
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_VIDEO_SIZE.to_string());
    let num_frames = input.num_frames.unwrap_or(DEFAULT_NUM_FRAMES).max(1);
    let fps = input.fps.unwrap_or(DEFAULT_FPS).max(1);
    let num_inference_steps = input
        .num_inference_steps
        .unwrap_or(DEFAULT_NUM_INFERENCE_STEPS)
        .max(1);
    let guidance_scale = input
        .guidance_scale
        .unwrap_or(DEFAULT_GUIDANCE_SCALE)
        .max(0.0);
    let guidance_scale_2 = input
        .guidance_scale_2
        .unwrap_or(DEFAULT_GUIDANCE_SCALE_2)
        .max(0.0);
    let boundary_ratio = input
        .boundary_ratio
        .unwrap_or(DEFAULT_BOUNDARY_RATIO)
        .clamp(0.0, 1.0);
    let flow_shift = input.flow_shift.unwrap_or(DEFAULT_FLOW_SHIFT);
    let seed = input.seed.unwrap_or(DEFAULT_SEED);

    let client = reqwest::Client::new();

    if is_kuaizi_video_api(&url) {
        let (resolution, ratio, duration) = if input.resolution.is_some()
            || input.ratio.is_some()
            || input.duration.is_some()
        {
            (
                resolve_kuaizi_text_field(
                    input.resolution.as_deref(),
                    KUAIZI_DEFAULT_RESOLUTION,
                )
                .to_string(),
                resolve_kuaizi_text_field(input.ratio.as_deref(), KUAIZI_DEFAULT_RATIO)
                    .to_string(),
                input.duration.unwrap_or(KUAIZI_DEFAULT_DURATION).max(1),
            )
        } else {
            map_size_to_kuaizi_params(&size, num_frames, fps)
        };

        return generate_video_kuaizi(
            &client,
            prompt,
            &url,
            &api_key,
            resolve_kuaizi_text_field(input.mode.as_deref(), KUAIZI_DEFAULT_MODE),
            &resolution,
            &ratio,
            duration,
            resolve_kuaizi_text_field(
                input.generation_type.as_deref(),
                KUAIZI_DEFAULT_GENERATION_TYPE,
            ),
        )
        .await;
    }

    generate_video_wan_sync(
        &client,
        prompt,
        &url,
        &api_key,
        &size,
        num_frames,
        fps,
        num_inference_steps,
        guidance_scale,
        guidance_scale_2,
        boundary_ratio,
        flow_shift,
        seed,
    )
    .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImageToVideoInput {
    pub prompt: String,
    pub input_reference_b64: String,
    pub input_reference_filename: Option<String>,
    pub negative_prompt: Option<String>,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    pub size: Option<String>,
    pub num_frames: Option<u32>,
    pub fps: Option<u32>,
    pub num_inference_steps: Option<u32>,
    pub guidance_scale: Option<f64>,
    pub guidance_scale_2: Option<f64>,
    pub boundary_ratio: Option<f64>,
    pub flow_shift: Option<f64>,
    pub seed: Option<i64>,
}

fn mime_for_filename(filename: &str) -> &'static str {
    let lower = filename.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else {
        "image/jpeg"
    }
}

#[tauri::command]
pub async fn generate_image_to_video(
    input: GenerateImageToVideoInput,
) -> Result<GenerateVideoResult, String> {
    let prompt = input.prompt.trim();
    if prompt.is_empty() {
        return Err("提示词不能为空".to_string());
    }

    let reference_b64 = input.input_reference_b64.trim();
    if reference_b64.is_empty() {
        return Err("参考图片不能为空".to_string());
    }

    let reference_bytes = base64::engine::general_purpose::STANDARD
        .decode(reference_b64)
        .map_err(|error| format!("参考图片解码失败: {error}"))?;
    if reference_bytes.is_empty() {
        return Err("参考图片不能为空".to_string());
    }

    let reference_filename = input
        .input_reference_filename
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "reference.jpg".to_string());
    let reference_part = Part::bytes(reference_bytes)
        .file_name(reference_filename.clone())
        .mime_str(mime_for_filename(&reference_filename))
        .map_err(|error| format!("参考图片格式无效: {error}"))?;

    let url = input
        .api_url
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_IMAGE_TO_VIDEO_API_URL.to_string());
    let api_key = input
        .api_key
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_IMAGE_TO_VIDEO_API_KEY.to_string());
    let size = input
        .size
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_VIDEO_SIZE.to_string());
    let num_frames = input.num_frames.unwrap_or(DEFAULT_NUM_FRAMES).max(1);
    let fps = input.fps.unwrap_or(DEFAULT_FPS).max(1);
    let num_inference_steps = input
        .num_inference_steps
        .unwrap_or(DEFAULT_NUM_INFERENCE_STEPS)
        .max(1);
    let guidance_scale = input
        .guidance_scale
        .unwrap_or(DEFAULT_IMAGE_TO_VIDEO_GUIDANCE_SCALE)
        .max(0.0);
    let guidance_scale_2 = input
        .guidance_scale_2
        .unwrap_or(DEFAULT_IMAGE_TO_VIDEO_GUIDANCE_SCALE_2)
        .max(0.0);
    let boundary_ratio = input
        .boundary_ratio
        .unwrap_or(DEFAULT_BOUNDARY_RATIO)
        .clamp(0.0, 1.0);
    let flow_shift = input
        .flow_shift
        .unwrap_or(DEFAULT_IMAGE_TO_VIDEO_FLOW_SHIFT);
    let seed = input.seed.unwrap_or(DEFAULT_SEED);
    let negative_prompt = input
        .negative_prompt
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_IMAGE_TO_VIDEO_NEGATIVE_PROMPT.to_string());

    println!(
        "[ImageToVideo] 发送 → {url} size={size} frames={num_frames} fps={fps} steps={num_inference_steps} reference={reference_filename}"
    );

    let form = Form::new()
        .text("prompt", prompt.to_string())
        .part("input_reference", reference_part)
        .text("size", size.clone())
        .text("num_frames", num_frames.to_string())
        .text("fps", fps.to_string())
        .text("negative_prompt", negative_prompt)
        .text("num_inference_steps", num_inference_steps.to_string())
        .text("guidance_scale", format_f64(guidance_scale))
        .text("guidance_scale_2", format_f64(guidance_scale_2))
        .text("boundary_ratio", format_f64(boundary_ratio))
        .text("flow_shift", format_f64(flow_shift))
        .text("seed", seed.to_string());

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key.trim()))
        .multipart(form)
        .send()
        .await
        .map_err(|error| map_request_error(&error, &url))?;

    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("读取图生视频服务响应失败: {error}"))?;

    println!(
        "[ImageToVideo] 接收 ← HTTP {} content-type={} bytes={}",
        status.as_u16(),
        content_type,
        bytes.len()
    );

    if !status.is_success() {
        let text = String::from_utf8_lossy(&bytes);
        return Err(parse_error_message(&text, status.as_u16()));
    }

    if bytes.is_empty() {
        return Err("图生视频服务未返回视频数据".to_string());
    }

    let video_b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(GenerateVideoResult { video_b64 })
}

fn parse_error_message(text: &str, status: u16) -> String {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(message) = json
            .pointer("/error/message")
            .and_then(|value| value.as_str())
        {
            return message.to_string();
        }
        if let Some(message) = json.get("message").and_then(|value| value.as_str()) {
            return message.to_string();
        }
    }
    if text.trim().is_empty() {
        format!("视频生成失败（HTTP {status}）")
    } else {
        text.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_kuaizi_provider() {
        assert!(is_kuaizi_video_api(KUAIZI_DEFAULT_CREATE_URL));
        assert!(!is_kuaizi_video_api(DEFAULT_VIDEO_API_URL));
    }

    #[test]
    fn derives_kuaizi_status_url() {
        assert_eq!(
            kuaizi_status_url(KUAIZI_DEFAULT_CREATE_URL),
            "https://aiopenapi.kuaizi.cn/ai-open-platform-api/v1/lz/video/task/status"
        );
    }

    #[test]
    fn recognizes_kuaizi_running_status() {
        assert!(is_kuaizi_running_status("running"));
        assert!(is_kuaizi_running_status("运行中"));
        assert!(!is_kuaizi_running_status("success"));
    }

    #[test]
    fn normalizes_kuaizi_domain_only_url() {
        assert_eq!(
            normalize_kuaizi_create_url("https://aiopenapi.kuaizi.cn"),
            KUAIZI_DEFAULT_CREATE_URL
        );
        assert_eq!(
            normalize_kuaizi_create_url("https://aiopenapi.kuaizi.cn/ai-open-platform-api"),
            KUAIZI_DEFAULT_CREATE_URL
        );
    }

    #[test]
    fn maps_size_to_kuaizi_params() {
        let (resolution, ratio, duration) = map_size_to_kuaizi_params("1280x720", 160, 16);
        assert_eq!(resolution, "720p");
        assert_eq!(ratio, "16:9");
        assert_eq!(duration, 10);
    }
}
