import { SESSION_ASSISTANT_PROMPT } from "../../prompts/session/textflowAssistant";
import { TEXTFLOW_PRODUCT_SKILL } from "../../prompts/session/textflowProductSkill";
import {
  type ChatCompletionMessage,
  streamChatCompletion,
} from "../../services/chat";
import type { AppConfig } from "../../types";

const MAX_HISTORY = 24;

export interface SessionChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function buildSessionSystemPrompt(agentObservation?: string | null): string {
  const parts = [SESSION_ASSISTANT_PROMPT, TEXTFLOW_PRODUCT_SKILL];
  if (agentObservation?.trim()) {
    parts.push(`## 本地 Agent 读取结果\n${agentObservation.trim()}`);
  }
  return parts.join("\n\n");
}

export async function* streamSessionChat(options: {
  config: AppConfig;
  model: string;
  history: SessionChatTurn[];
  agentObservation?: string | null;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const { config, model, history, agentObservation, signal } = options;

  const messages: ChatCompletionMessage[] = [
    { role: "system", content: buildSessionSystemPrompt(agentObservation) },
    ...history.slice(-MAX_HISTORY).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];

  yield* streamChatCompletion(config, model, messages, signal);
}
