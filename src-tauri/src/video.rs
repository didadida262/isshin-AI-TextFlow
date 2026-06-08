use base64::Engine;
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};

const DEFAULT_VIDEO_API_URL: &str = "http://27.159.92.210:8081/v1/videos/sync";
const DEFAULT_VIDEO_API_KEY: &str = "wan2.2-ti2v-5b@srd*OB6sgdessj8YTF8HBVGhIYTgd76sfR";
const DEFAULT_IMAGE_TO_VIDEO_API_URL: &str =
    "http://27.159.92.210:8081/v1/videos/sync";
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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateVideoResult {
    pub video_b64: String,
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

    println!(
        "[Video] 发送 → {url} size={size} frames={num_frames} fps={fps} steps={num_inference_steps}"
    );

    let form = Form::new()
        .text("prompt", prompt.to_string())
        .text("size", size.clone())
        .text("num_frames", num_frames.to_string())
        .text("fps", fps.to_string())
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
        .map_err(|error| format!("读取视频服务响应失败: {error}"))?;

    println!(
        "[Video] 接收 ← HTTP {} content-type={} bytes={}",
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

    let video_b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(GenerateVideoResult { video_b64 })
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
