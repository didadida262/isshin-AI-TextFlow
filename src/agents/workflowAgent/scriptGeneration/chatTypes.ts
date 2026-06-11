import type { ScriptPipelineStage } from "./types";

export type ScriptChatMessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "error"
  | "stop";

export interface ScriptChatSuggestion {
  title: string;
  prompt: string;
}

export interface ScriptChatThinking {
  title: string;
  text: string;
  collapsed?: boolean;
}

export interface ScriptChatMessage {
  id: string;
  role: "user" | "assistant";
  name?: string;
  content: string;
  thinking?: ScriptChatThinking;
  suggestions?: ScriptChatSuggestion[];
  status?: ScriptChatMessageStatus;
  /** Highlights a completed pipeline stage in the chat timeline. */
  milestone?: ScriptPipelineStage;
}
