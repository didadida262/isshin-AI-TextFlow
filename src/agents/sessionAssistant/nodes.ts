import { invoke } from "@tauri-apps/api/core";
import {
  type AgentGraphState,
  type AssistantContextResult,
  isDataQuery,
} from "./schema";

/** 节点一：Thought — 判断是否为数据类问题 */
export async function thoughtNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  if (!isDataQuery(state.userMessage)) {
    return {
      thought: "用户消息未触发数据库查询，走普通对话。",
      shouldAct: false,
      phase: "done",
    };
  }

  return {
    thought: "检测到数据类问题，准备查询本地数据库（项目与工作流状态）。",
    shouldAct: true,
    phase: "thought",
  };
}

/** 节点二：Action — 通过 Tauri IPC 查询 SQLite 业务数据 */
export async function actionNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  if (!state.shouldAct) {
    return { phase: "done" };
  }

  try {
    const result = await invoke<AssistantContextResult>("query_assistant_context");

    return {
      dbContext: result,
      errorMessage: null,
      phase: "action",
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return {
      dbContext: null,
      errorMessage: err,
      phase: "action",
    };
  }
}

/** 节点三：Observation — 将查询结果格式化为可拼入对话的 Markdown */
export function observationNode(
  state: AgentGraphState,
): Partial<AgentGraphState> {
  if (!state.shouldAct) {
    return { observation: null, phase: "done" };
  }

  if (state.errorMessage) {
    return {
      observation: `**数据库查询失败**\n\n\`\`\`\n${state.errorMessage}\n\`\`\``,
      phase: "observation",
    };
  }

  if (!state.dbContext) {
    return {
      observation: "**数据库查询完成**，但未返回数据。",
      phase: "observation",
    };
  }

  const observation = [
    `**数据库查询结果** — 共 ${state.dbContext.projectCount} 个项目`,
    "",
    "请严格基于以下 JSON 回答用户关于项目、工作流节点、章节、剧本、资产等数据的问题，不要编造未出现在数据中的内容。",
    "",
    "```json",
    JSON.stringify(state.dbContext, null, 2),
    "```",
  ].join("\n");

  return { observation, phase: "done" };
}
