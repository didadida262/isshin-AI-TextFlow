/** 侧边栏主导航 */
export type AppNav = "session" | "creation";

/** 对话模式：普通直连 LLM / 启用本地 Agent 工具链 */
export type ChatMode = "chat" | "agent";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
}

export interface CreationProject {
  id: string;
  name: string;
  projectType: string;
  novelType: string;
  imageModel: string;
  imageQuality: string;
  videoModel: string;
  videoMode: string;
  aspectRatio: string;
  intro: string;
  artStyle: string;
  directorManual: string;
  createdAt: number;
}

export interface AppConfig {
  baseUrl: string;
  apiKey: string;
  models: string[];
}

export type MessageRole = "user" | "assistant" | "agent-status";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  agentPhase?: "thought" | "action" | "observation" | "done";
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface AgentFileResult {
  filename: string;
  content: string;
  path: string;
}
