import { ADAPTATION_STRATEGY_PROMPT } from "../../../prompts/workflowAgent/scriptGeneration/adaptationStrategy";
import { chatCompletion } from "../../../services/chat";
import { stripThink } from "../../../utils/stripThink";
import {
  buildMarkdownRetryHint,
  parseAdaptationStrategyOutput,
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

const STRATEGY_SECTIONS = "改编基调、人物改编、场景改编、分集脚本指引、衔接规则";

export async function runAdaptationStrategyAgent(
  ctx: ScriptAgentContext,
): Promise<string> {
  const baseUserContent = [
    buildProjectConfigBlock(ctx.project),
    buildDirectorSkillBlock(ctx.directorSkillContent),
    `\n总章节数：${ctx.chapters.length}`,
    "\n## 故事骨架\n",
    ctx.workData.storySkeleton,
    "\n## 章节事件表\n",
    formatChapterEvents(ctx.chapters),
    "\n请基于故事骨架制定改编策略。先写 200-300 字思路阐述，再以 Markdown 输出正文（从 ## 改编基调 开始）。",
    buildDirectorManualTaskReminder(ctx.directorSkillContent),
  ].join("\n");

  let lastError = "改编策略 Agent 未返回有效的 Markdown 正文";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (ctx.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const raw = await chatCompletion(
      ctx.config,
      ctx.model,
      [
        { role: "system", content: ADAPTATION_STRATEGY_PROMPT },
        {
          role: "user",
          content:
            baseUserContent +
            buildMarkdownRetryHint("改编基调", STRATEGY_SECTIONS, attempt),
        },
      ],
      ctx.signal,
      "script-adaptation",
      { maxTokens: SCRIPT_MAX_TOKENS },
    );

    const strategy = parseAdaptationStrategyOutput(stripThink(raw));
    if (strategy) {
      return strategy;
    }

    lastError = `改编策略 Agent 未返回有效的 Markdown 正文（尝试 ${attempt + 1}/${MAX_ATTEMPTS}）`;
  }

  throw new Error(lastError);
}
