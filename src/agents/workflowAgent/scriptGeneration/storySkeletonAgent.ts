import { STORY_SKELETON_PROMPT } from "../../../prompts/workflowAgent/scriptGeneration/storySkeleton";
import { chatCompletion } from "../../../services/chat";
import { stripThink } from "../../../utils/stripThink";
import {
  buildXmlRetryHint,
  parseTaggedAgentOutput,
} from "../../../utils/xmlTags";
import {
  buildProjectConfigBlock,
  formatChapterEvents,
} from "./tools";
import type { ScriptAgentContext } from "./types";

const MAX_ATTEMPTS = 3;
const SCRIPT_MAX_TOKENS = 8192;

export async function runStorySkeletonAgent(
  ctx: ScriptAgentContext,
): Promise<string> {
  const eventsBlock = formatChapterEvents(ctx.chapters);
  const skillBlock = ctx.directorSkillContent
    ? `\n## 导演叙事手册\n${ctx.directorSkillContent}`
    : "";

  const baseUserContent = [
    buildProjectConfigBlock(ctx.project),
    skillBlock,
    `\n总章节数：${ctx.chapters.length}（默认 1 章 = 1 集）`,
    "\n## 章节事件表\n",
    eventsBlock,
    "\n请基于以上事件表构建故事骨架，并按 XML 格式输出 <storySkeleton>。",
  ].join("\n");

  let lastError = "故事骨架 Agent 未返回有效的 <storySkeleton> 内容";

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
          content: baseUserContent + buildXmlRetryHint("storySkeleton", attempt),
        },
      ],
      ctx.signal,
      "script-skeleton",
      { maxTokens: SCRIPT_MAX_TOKENS },
    );

    const skeleton = parseTaggedAgentOutput(stripThink(raw), "storySkeleton");
    if (skeleton) {
      return skeleton;
    }

    lastError = `故事骨架 Agent 未返回有效的 <storySkeleton> 内容（尝试 ${attempt + 1}/${MAX_ATTEMPTS}）`;
  }

  throw new Error(lastError);
}
