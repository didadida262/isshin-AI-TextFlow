use serde::{Deserialize, Serialize};
use serde_json::Value;

const LOG_TEXT_LIMIT: usize = 100;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmRequestPayload {
    pub url: String,
    pub api_key: String,
    pub body: Value,
    #[allow(dead_code)]
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmChatCompletionResult {
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmInboundLog {
    pub data: String,
}

fn truncate(text: &str, max: usize) -> String {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= max {
        return text.to_string();
    }
    chars.into_iter().take(max).collect::<String>() + "…"
}

fn body_for_log(body: &Value) -> Value {
    let mut cloned = body.clone();
    if let Some(messages) = cloned.get_mut("messages").and_then(|value| value.as_array_mut()) {
        for message in messages.iter_mut() {
            if let Some(content) = message.get("content").and_then(|value| value.as_str()) {
                message["content"] = Value::String(truncate(content, LOG_TEXT_LIMIT));
            }
        }
    }
    cloned
}

fn format_received(raw: &str) -> String {
    if let Ok(json) = serde_json::from_str::<Value>(raw) {
        if let Some(content) = json
            .pointer("/choices/0/message/content")
            .and_then(|value| value.as_str())
        {
            return content.to_string();
        }
    }
    raw.to_string()
}

fn log_send(body: &Value) {
    let display = serde_json::to_string(&body_for_log(body)).unwrap_or_else(|_| body.to_string());
    println!("[LLM] 发送 → {display}");
}

fn log_recv(raw: &str) {
    println!("[LLM] 接收 ← {}", format_received(raw));
}

#[tauri::command]
pub fn llm_log_outbound(payload: LlmRequestPayload) -> Result<(), String> {
    log_send(&payload.body);
    Ok(())
}

#[tauri::command]
pub fn llm_log_inbound(log: LlmInboundLog) -> Result<(), String> {
    log_recv(&log.data);
    Ok(())
}

fn parse_api_error(text: &str, status: reqwest::StatusCode) -> String {
    if let Ok(json) = serde_json::from_str::<Value>(text) {
        let message = json
            .pointer("/error/message")
            .and_then(|value| value.as_str())
            .or_else(|| json.get("message").and_then(|value| value.as_str()));

        if let Some(message) = message {
            let unauthorized = status == reqwest::StatusCode::UNAUTHORIZED
                || json
                    .pointer("/error/type")
                    .and_then(|value| value.as_str())
                    == Some("unauthorized");

            if unauthorized {
                return format!("{message}。请打开左下角设置，检查 API Key 是否正确。");
            }
            return message.to_string();
        }
    }

    text.to_string()
}

#[tauri::command]
pub async fn llm_chat_completion(
    payload: LlmRequestPayload,
) -> Result<LlmChatCompletionResult, String> {
    log_send(&payload.body);

    let client = reqwest::Client::new();
    let response = client
        .post(&payload.url)
        .header(
            "Authorization",
            format!("Bearer {}", payload.api_key.trim()),
        )
        .header("Content-Type", "application/json")
        .json(&payload.body)
        .send()
        .await
        .map_err(|error| format!("LLM 请求失败: {error}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("读取 LLM 响应失败: {error}"))?;

    log_recv(&text);

    if !status.is_success() {
        return Err(parse_api_error(&text, status));
    }

    let json: Value =
        serde_json::from_str(&text).map_err(|error| format!("解析 LLM 响应失败: {error}"))?;
    let content = json
        .pointer("/choices/0/message/content")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "模型未返回 content".to_string())?
        .to_string();

    Ok(LlmChatCompletionResult { content })
}
