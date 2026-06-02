use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const DEFAULT_IMAGE_API_URL: &str = "http://27.159.92.216:8091/v1/images/generations";
const DEFAULT_IMAGE_API_KEY: &str = "qwen-image@srd*wrtU8EVDF20bNF";
const IMAGE_MODEL: &str = "qwen-image-2512";
const DEFAULT_IMAGE_SIZE: &str = "1024x1024";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImageInput {
    pub prompt: String,
    pub size: Option<String>,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImageResult {
    pub b64_json: String,
}

fn map_request_error(error: &reqwest::Error, url: &str) -> String {
    if error.is_connect() || error.is_timeout() {
        return format!(
            "无法连接图片服务（{url}），请确认本地图片 API 已启动。测试命令：curl {url}"
        );
    }
    format!("图片生成请求失败: {error}")
}

#[tauri::command]
pub async fn generate_image(input: GenerateImageInput) -> Result<GenerateImageResult, String> {
    let prompt = input.prompt.trim();
    if prompt.is_empty() {
        return Err("提示词不能为空".to_string());
    }

    let url = input
        .api_url
        .unwrap_or_else(|| DEFAULT_IMAGE_API_URL.to_string());
    let api_key = input
        .api_key
        .unwrap_or_else(|| DEFAULT_IMAGE_API_KEY.to_string());

    let size = input
        .size
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_IMAGE_SIZE.to_string());

    let body = json!({
        "model": IMAGE_MODEL,
        "prompt": prompt,
        "n": 1,
        "size": size,
        "response_format": "b64_json",
    });

    println!("[Image] 发送 → {url} model={IMAGE_MODEL} size={size}");

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key.trim()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| map_request_error(&error, &url))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("读取图片服务响应失败: {error}"))?;

    println!(
        "[Image] 接收 ← HTTP {} {}",
        status.as_u16(),
        truncate_for_log(&text)
    );

    if !status.is_success() {
        return Err(parse_error_message(&text, status.as_u16()));
    }

    let json: Value =
        serde_json::from_str(&text).map_err(|error| format!("解析图片服务响应失败: {error}"))?;
    let b64_json = json
        .pointer("/data/0/b64_json")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "图片服务未返回 b64_json 数据".to_string())?
        .to_string();

    Ok(GenerateImageResult { b64_json })
}

fn truncate_for_log(text: &str) -> String {
    if text.len() <= 120 {
        return text.to_string();
    }
    format!("{}…", &text[..120])
}

fn parse_error_message(text: &str, status: u16) -> String {
    if let Ok(json) = serde_json::from_str::<Value>(text) {
        if let Some(message) = json
            .pointer("/error/message")
            .and_then(|value| value.as_str())
        {
            return message.to_string();
        }
    }
    if text.trim().is_empty() {
        format!("图片生成失败（HTTP {status}）")
    } else {
        text.to_string()
    }
}
