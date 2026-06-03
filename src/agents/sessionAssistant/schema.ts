/** Agent 状态 — Thought-Action-Observation，Action 查询本地 SQLite */

export type AgentPhase = "idle" | "thought" | "action" | "observation" | "done";

export type WorkflowNodeStatus = "completed" | "current" | "notStarted";

export interface AssistantWorkflowNode {
  id: string;
  order: number;
  status: WorkflowNodeStatus;
}

export interface AssistantProjectSummary {
  hasNovelSource: boolean;
  novelCharCount: number;
  chapterCount: number;
  eventsSuccessCount: number;
  eventsPendingCount: number;
  eventsErrorCount: number;
  hasStorySkeleton: boolean;
  hasAdaptationStrategy: boolean;
  scriptsSuccessCount: number;
  scriptsErrorCount: number;
  scriptsPendingCount: number;
  assetsTotalCount: number;
}

export interface AssistantProjectContext {
  id: string;
  name: string;
  projectType: string;
  novelType: string;
  aspectRatio: string;
  intro: string;
  artStyle: string;
  directorManual: string;
  createdAt: number;
  updatedAt: number;
  currentWorkflowNode: string;
  workflowNodes: AssistantWorkflowNode[];
  summary: AssistantProjectSummary;
}

export interface AssistantContextResult {
  projectCount: number;
  projects: AssistantProjectContext[];
}

export interface AgentGraphState {
  userMessage: string;
  thought: string | null;
  shouldAct: boolean;
  dbContext: AssistantContextResult | null;
  errorMessage: string | null;
  phase: AgentPhase;
  observation: string | null;
}

/** 数据类问题意图：命中则查询数据库 */
export const DATA_QUERY_PATTERNS: RegExp[] = [
  /项目/,
  /数据/,
  /进度/,
  /工作流/,
  /流程/,
  /节点/,
  /状态/,
  /章节/,
  /剧本/,
  /资产/,
  /事件/,
  /小说/,
  /骨架/,
  /策略/,
  /分镜/,
  /视频/,
  /导出/,
  /导入/,
  /数据库/,
  /多少个/,
  /几个/,
  /多少/,
  /列表/,
  /有哪些/,
  /什么情况/,
  /完成情况/,
  /project/i,
  /workflow/i,
  /script/i,
  /chapter/i,
  /asset/i,
  /database/i,
  /novel/i,
];

export function isDataQuery(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return DATA_QUERY_PATTERNS.some((pattern) => pattern.test(trimmed));
}
