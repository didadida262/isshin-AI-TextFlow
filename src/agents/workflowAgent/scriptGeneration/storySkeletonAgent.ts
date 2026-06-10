import { STORY_SKELETON_PROMPT } from "../../../prompts/workflowAgent/scriptGeneration/storySkeleton";
import { chatCompletion } from "../../../services/chat";
import { stripThink } from "../../../utils/stripThink";
import {
  buildMarkdownRetryHint,
  getMissingStorySkeletonSections,
  parseStorySkeletonOutput,
} from "../../../utils/xmlTags";
import {
  buildDirectorManualTaskReminder,
  buildDirectorSkillBlock,
  buildProjectConfigBlock,
  formatChapterEvents,
} from "./tools";
import type { ScriptAgentContext } from "./types";

const MAX_ATTEMPTS = 3;
const SCRIPT_MAX_TOKENS = 8192;

const SKELETON_SECTIONS =
  "故事核、隐线、三幕结构、分集决策、全局删减决策表、付费卡点设计";

export async function runStorySkeletonAgent(
  ctx: ScriptAgentContext,
): Promise<string> {
  const eventsBlock = formatChapterEvents(ctx.chapters);

  const baseUserContent = [
    buildProjectConfigBlock(ctx.project),
    buildDirectorSkillBlock(ctx.directorSkillContent),
    `\n总章节数：${ctx.chapters.length}（默认 1 章 = 1 集）`,
    "\n## 章节事件表\n",
    eventsBlock,
    "\n请基于以上事件表构建故事骨架。先写 200-300 字思路阐述，再以 Markdown **一次性完整输出**全部 6 个章节（从 ## 故事核 至 ## 付费卡点设计，不得省略任何章节）。",
    "三幕结构、分集决策、全局删减决策表须使用 Markdown 表格；付费卡点设计须按集数列明钩子。",
    buildDirectorManualTaskReminder(ctx.directorSkillContent),
  ].join("\n");

  let lastError = "故事骨架 Agent 未返回有效的 Markdown 正文";
  let missingSections: string[] | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (ctx.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const raw = await chatCompletion(
      ctx.config,
      ctx.model,
      [
        { role: "system", content: STORY_SKELETON_PROMPT },
        {
          role: "user",
          content:
            baseUserContent +
            buildMarkdownRetryHint(
              "故事核",
              SKELETON_SECTIONS,
              attempt,
              missingSections,
            ),
        },
      ],
      ctx.signal,
      "script-skeleton",
      { maxTokens: SCRIPT_MAX_TOKENS },
    );

    const skeleton = parseStorySkeletonOutput(stripThink(raw));
    if (skeleton) {
      missingSections = getMissingStorySkeletonSections(skeleton);
      if (missingSections.length === 0) {
        return skeleton;
      }
      lastError = `故事骨架缺少章节：${missingSections.join("、")}（尝试 ${attempt + 1}/${MAX_ATTEMPTS}）`;
      continue;
    }

    missingSections = undefined;
    lastError = `故事骨架 Agent 未返回有效的 Markdown 正文（尝试 ${attempt + 1}/${MAX_ATTEMPTS}）`;
  }

  throw new Error(lastError);
}
