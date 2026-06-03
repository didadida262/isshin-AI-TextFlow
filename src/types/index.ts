/** 侧边栏主导航 */
export type AppNav = "session" | "creation";

/** 对话模式：直连 LLM / 启用 Assistant（产品助手 + 本地工具链） */
export type ChatMode = "chat" | "assistant";

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
  updatedAt: number;
}

/** 项目创作流程步骤 */
export type ProjectWorkflowStepId =
  | "extractEvents"
  | "aiScript"
  | "generateAssets"
  | "storyboard"
  | "generateVideo"
  | "editExport";

/** 流程节点状态（由后端计算） */
export type WorkflowNodeStatus = "completed" | "current" | "notStarted";

export interface ProjectWorkflowNode {
  id: ProjectWorkflowStepId;
  order: number;
  status: WorkflowNodeStatus;
}

export interface AppConfig {
  baseUrl: string;
  apiKey: string;
  models: string[];
  imageApiUrl: string;
  imageApiKey: string;
  imageModel: string;
  imageDefaultSize: string;
  imageCount: number;
}

export type MessageRole = "user" | "assistant" | "tool-status";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolPhase?: "thought" | "action" | "observation" | "done";
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
