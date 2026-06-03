import { invoke } from "@tauri-apps/api/core";
import {
  type AgentGraphState,
  type AssistantContextResult,
  describeAssistantQuery,
  resolveAssistantQuery,
} from "./schema";

/** 节点一：Thought — 解析数据类意图 */
export async function thoughtNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const queryRequest = resolveAssistantQuery(state.userMessage);
  if (!queryRequest) {
    return {
      thought: "用户消息未触发数据库查询，走普通对话。",
      shouldAct: false,
      queryRequest: null,
      phase: "done",
    };
  }

  return {
    thought: `检测到数据类问题：${describeAssistantQuery(queryRequest)}。`,
    shouldAct: true,
    queryRequest,
    phase: "thought",
  };
}

/** 节点二：Action — 按意图通过 Tauri IPC 查询 SQLite */
export async function actionNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  if (!state.shouldAct || !state.queryRequest) {
    return { phase: "done" };
  }

  try {
    const result = await invoke<AssistantContextResult>("query_assistant_context", {
      input: {
        queryKind: state.queryRequest.kind,
        episodeIndex: state.queryRequest.episodeIndex ?? null,
        userMessage: state.userMessage,
      },
    });

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

function formatObservationPayload(result: AssistantContextResult): string {
  const { queryKind, description, errorHint } = result;

  if (errorHint) {
    return [
      `**查询说明**：${description}`,
      "",
      `**提示**：${errorHint}`,
      "",
      "```json",
      JSON.stringify(result, null, 2),
      "```",
    ].join("\n");
  }

  const introByKind: Record<AssistantContextResult["queryKind"], string> = {
    script_episode:
      "以下为指定集数的剧本正文。请基于 `script.content` 回答用户，不要编造未出现在正文中的情节。",
    script_list:
      "以下为剧本目录（仅预览，不含全文）。若用户问某一集内容，应提示其说明集数。",
    story_skeleton: "以下为故事骨架全文，请据此回答。",
    adaptation_strategy: "以下为改编策略全文，请据此回答。",
    project_detail:
      "以下为单个项目的进度与工作流详情，请严格基于 JSON 回答，不要编造。",
    project_list:
      "以下为项目列表与简要统计，不含剧本正文。需要某集内容时请按集数单独查询。",
  };

  return [
    `**数据库查询结果** — ${description}`,
    "",
    introByKind[queryKind],
    "",
    "```json",
    JSON.stringify(result, null, 2),
    "```",
  ].join("\n");
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

  return {
    observation: formatObservationPayload(state.dbContext),
    phase: "done",
  };
}
