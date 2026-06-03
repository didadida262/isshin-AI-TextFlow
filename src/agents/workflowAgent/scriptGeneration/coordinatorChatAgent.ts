import { COORDINATOR_PROMPT } from "../../../prompts/workflowAgent/scriptGeneration/coordinator";
import {
  type ChatCompletionMessage,
  streamChatCompletion,
} from "../../../services/chat";
import {
  isEventExtractionComplete,
  type NovelChapterRecord,
} from "../../../services/novel";
import {
  SCRIPT_STATE_ERROR,
  SCRIPT_STATE_SUCCESS,
  type ScriptRecord,
  type ScriptWorkData,
} from "../../../services/script";
import type { AppConfig, CreationProject } from "../../../types";
import { buildProjectConfigBlock } from "./tools";

const MAX_HISTORY = 16;

function buildProjectStatusBlock(
  chapters: NovelChapterRecord[],
  workData: ScriptWorkData,
  scripts: ScriptRecord[],
): string {
  const eventsReady = isEventExtractionComplete(chapters);
  const skeletonDone = workData.storySkeleton.trim().length > 0;
  const strategyDone = workData.adaptationStrategy.trim().length > 0;
  const successCount = scripts.filter(
    (item) => item.scriptState === SCRIPT_STATE_SUCCESS,
  ).length;
  const failedCount = scripts.filter(
    (item) => item.scriptState === SCRIPT_STATE_ERROR,
  ).length;

  return [
    "## 当前项目状态",
    `事件提取：${eventsReady ? "已完成" : "未完成"}`,
    `故事骨架：${skeletonDone ? "已生成" : "未生成"}`,
    `改编策略：${strategyDone ? "已生成" : "未生成"}`,
    `逐集剧本：${scripts.length === 0 ? "未开始" : `成功 ${successCount} 集${failedCount > 0 ? `，失败 ${failedCount} 集` : ""}`}`,
    `总章节数：${chapters.length}`,
  ].join("\n");
}

export interface CoordinatorChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function* streamCoordinatorChat(
  options: {
    project: CreationProject;
    config: AppConfig;
    model: string;
    chapters: NovelChapterRecord[];
    workData: ScriptWorkData;
    scripts: ScriptRecord[];
    history: CoordinatorChatTurn[];
    signal?: AbortSignal;
  },
): AsyncGenerator<string> {
  const {
    project,
    config,
    model,
    chapters,
    workData,
    scripts,
    history,
    signal,
  } = options;

  const systemContent = [
    COORDINATOR_PROMPT,
    buildProjectConfigBlock(project),
    buildProjectStatusBlock(chapters, workData, scripts),
  ].join("\n\n");

  const recentHistory = history.slice(-MAX_HISTORY);
  const messages: ChatCompletionMessage[] = [
    { role: "system", content: systemContent },
    ...recentHistory.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];

  yield* streamChatCompletion(config, model, messages, signal);
}
