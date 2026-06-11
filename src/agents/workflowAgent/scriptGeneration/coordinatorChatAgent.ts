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
import { buildProjectConfigBlock, formatChapterEvents } from "./tools";

const MAX_HISTORY = 16;
const KNOWLEDGE_SECTION_MAX_CHARS = 8000;
const SCRIPT_EXCERPT_MAX_CHARS = 600;

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

function formatKnowledgeSection(title: string, content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const body =
    trimmed.length <= KNOWLEDGE_SECTION_MAX_CHARS
      ? trimmed
      : `${trimmed.slice(0, KNOWLEDGE_SECTION_MAX_CHARS)}\n\n（篇幅较长，以上为节选；完整内容见右侧工作台对应 Tab）`;

  return `## ${title}\n${body}`;
}

function buildProjectKnowledgeBlock(
  chapters: NovelChapterRecord[],
  workData: ScriptWorkData,
  scripts: ScriptRecord[],
): string {
  const sections: string[] = [];

  if (chapters.length > 0) {
    sections.push(
      formatKnowledgeSection("章节事件表", formatChapterEvents(chapters)),
    );
  }

  const skeleton = formatKnowledgeSection("故事骨架", workData.storySkeleton);
  if (skeleton) sections.push(skeleton);

  const strategy = formatKnowledgeSection(
    "改编策略",
    workData.adaptationStrategy,
  );
  if (strategy) sections.push(strategy);

  const successfulScripts = scripts
    .filter(
      (item) =>
        item.scriptState === SCRIPT_STATE_SUCCESS && item.content.trim().length > 0,
    )
    .sort((a, b) => a.episodeIndex - b.episodeIndex);

  if (successfulScripts.length > 0) {
    const scriptDigest = successfulScripts
      .map((item) => {
        const excerpt = item.content.trim();
        const preview =
          excerpt.length <= SCRIPT_EXCERPT_MAX_CHARS
            ? excerpt
            : `${excerpt.slice(0, SCRIPT_EXCERPT_MAX_CHARS)}…`;
        return `第${item.episodeIndex}集《${item.name}》\n${preview}`;
      })
      .join("\n\n");
    sections.push(formatKnowledgeSection("逐集剧本摘要", scriptDigest));
  }

  if (sections.length === 0) {
    return [
      "## 项目资料",
      "（尚无章节事件或剧本产出。可结合「项目配置」中的作品简介回答宏观问题；细节需先完成事件提取或剧本生成。）",
    ].join("\n");
  }

  return [
    "## 项目资料（回答剧情、人物、结构问题时请优先引用本节）",
    ...sections,
  ].join("\n\n");
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
    buildProjectKnowledgeBlock(chapters, workData, scripts),
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
