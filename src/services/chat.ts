import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig } from "../types";
import { resolveApiUrl } from "./api";
import { parseApiErrorMessage } from "../utils/parseApiError";

export interface ChatCompletionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface LlmRequestPayload {
  url: string;
  apiKey: string;
  body: Record<string, unknown>;
  label?: string;
}

interface LlmInboundLog {
  data: string;
}

async function logLlmOutbound(payload: LlmRequestPayload): Promise<void> {
  await invoke("llm_log_outbound", { payload });
}

async function logLlmInbound(log: LlmInboundLog): Promise<void> {
  await invoke("llm_log_inbound", { log });
}

export async function testConnection(
  config: AppConfig,
  model: string,
): Promise<void> {
  const url = resolveApiUrl(config.baseUrl, "/chat/completions");
  await invoke<{ content: string }>("llm_chat_completion", {
    payload: {
      url,
      apiKey: config.apiKey,
      label: "test-connection",
      body: {
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      },
    } satisfies LlmRequestPayload,
  });
}

export interface ChatCompletionOptions {
  maxTokens?: number;
}

export async function chatCompletion(
  config: AppConfig,
  model: string,
  messages: ChatCompletionMessage[],
  signal?: AbortSignal,
  label = "chat-completion",
  options?: ChatCompletionOptions,
): Promise<string> {
  if (signal?.aborted) {
    throw new Error("Request cancelled");
  }

  const url = resolveApiUrl(config.baseUrl, "/chat/completions");
  const result = await invoke<{ content: string }>("llm_chat_completion", {
    payload: {
      url,
      apiKey: config.apiKey,
      label,
      body: {
        model,
        messages,
        stream: false,
        ...(options?.maxTokens != null ? { max_tokens: options.maxTokens } : {}),
      },
    } satisfies LlmRequestPayload,
  });

  if (signal?.aborted) {
    throw new Error("Request cancelled");
  }

  return result.content;
}

export async function* streamChatCompletion(
  config: AppConfig,
  model: string,
  messages: ChatCompletionMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const url = resolveApiUrl(config.baseUrl, "/chat/completions");
  const body = {
    model,
    messages,
    stream: true,
  };

  await logLlmOutbound({
    url,
    apiKey: config.apiKey,
    label: "chat-stream",
    body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const responseText = await res.text();
    void logLlmInbound({ data: responseText });
    throw new Error(parseApiErrorMessage(responseText, res.status));
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let buffer = "";
  let received = "";

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      return;
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        void logLlmInbound({ data: received });
        return;
      }

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          received += delta;
          yield delta;
        }
      } catch {
        /* skip malformed SSE chunk */
      }
    }
  }

  if (received) {
    void logLlmInbound({ data: received });
  }
}
