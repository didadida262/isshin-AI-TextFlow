/** Agent 状态 — Thought-Action-Observation，Action 按意图查询本地 SQLite */

export type AgentPhase = "idle" | "thought" | "action" | "observation" | "done";

export type WorkflowNodeStatus =
  | "completed"
  | "current"
  | "available"
  | "notStarted";

export type AssistantQueryKind =
  | "project_list"
  | "project_detail"
  | "script_episode"
  | "script_list"
  | "story_skeleton"
  | "adaptation_strategy";

export interface AssistantQueryRequest {
  kind: AssistantQueryKind;
  episodeIndex?: number;
}

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

export interface AssistantProjectBrief {
  id: string;
  name: string;
  currentWorkflowNode: string;
  summary: AssistantProjectSummary;
}

export interface AssistantProjectContext extends AssistantProjectBrief {
  projectType: string;
  novelType: string;
  aspectRatio: string;
  intro: string;
  artStyle: string;
  directorManual: string;
  createdAt: number;
  updatedAt: number;
  workflowNodes: AssistantWorkflowNode[];
}

export interface AssistantScriptBrief {
  episodeIndex: number;
  name: string;
  scriptState: number;
  contentLength: number;
  contentPreview: string;
}

export interface AssistantScriptRecord {
  id: number;
  projectId: string;
  episodeIndex: number;
  name: string;
  content: string;
  scriptState: number;
  errorReason: string | null;
  updatedAt: number;
  contentTruncated?: boolean;
}

export interface AssistantContextResult {
  queryKind: AssistantQueryKind;
  description: string;
  project?: AssistantProjectContext;
  projects?: AssistantProjectBrief[];
  script?: AssistantScriptRecord;
  scripts?: AssistantScriptBrief[];
  storySkeleton?: string;
  adaptationStrategy?: string;
  errorHint?: string;
}

export interface AgentGraphState {
  userMessage: string;
  thought: string | null;
  shouldAct: boolean;
  queryRequest: AssistantQueryRequest | null;
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
  /写了什么/,
  /讲了什么/,
  /project/i,
  /workflow/i,
  /script/i,
  /chapter/i,
  /asset/i,
  /database/i,
  /novel/i,
];

const EPISODE_PATTERNS: RegExp[] = [
  /第\s*(\d+)\s*集/,
  /(?:episode|ep)\s*#?\s*(\d+)/i,
  /(\d+)\s*集(?:的)?(?:剧本)?/,
];

export function isDataQuery(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return DATA_QUERY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function parseEpisodeIndex(message: string): number | null {
  for (const pattern of EPISODE_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const index = Number.parseInt(match[1], 10);
      if (Number.isFinite(index) && index > 0) return index;
    }
  }
  return null;
}

/** 根据用户消息解析应执行的 DB 查询类型 */
export function resolveAssistantQuery(message: string): AssistantQueryRequest | null {
  const trimmed = message.trim();
  if (!isDataQuery(trimmed)) return null;

  const episodeIndex = parseEpisodeIndex(trimmed);

  if (/剧本/.test(trimmed)) {
    if (episodeIndex != null) {
      return { kind: "script_episode", episodeIndex };
    }
    if (/列表|有哪些|几集|多少集|全部|所有|写了什么|内容|讲了|说了|是什么|全文/.test(trimmed)) {
      return { kind: "script_list" };
    }
  }

  if (/骨架/.test(trimmed) && /内容|什么|写了|看看|查看|讲了|说了/.test(trimmed)) {
    return { kind: "story_skeleton" };
  }

  if (/改编策略|改编/.test(trimmed) && /内容|什么|写了|看看|查看|策略/.test(trimmed)) {
    return { kind: "adaptation_strategy" };
  }

  if (/项目列表|有哪些项目|多少项目|几个项目|所有项目/.test(trimmed)) {
    return { kind: "project_list" };
  }

  if (/进度|状态|完成情况|工作流|节点|详情|数据概况|概况/.test(trimmed)) {
    return { kind: "project_detail" };
  }

  return { kind: "project_list" };
}

export function describeAssistantQuery(query: AssistantQueryRequest): string {
  switch (query.kind) {
    case "script_episode":
      return `查询第 ${query.episodeIndex} 集剧本正文`;
    case "script_list":
      return "查询项目剧本列表（不含全文）";
    case "story_skeleton":
      return "查询故事骨架";
    case "adaptation_strategy":
      return "查询改编策略";
    case "project_detail":
      return "查询单个项目进度与工作流详情";
    case "project_list":
      return "查询项目列表与简要进度";
  }
}
