import { ADAPTATION_STRATEGY_PROMPT } from "../../prompts/workflowAgent/adaptationStrategy";
import { chatCompletion } from "../../services/chat";
import { stripThink } from "../../utils/stripThink";
import {
  buildXmlRetryHint,
  parseTaggedAgentOutput,
} from "../../utils/xmlTags";
import {
  buildProjectConfigBlock,
  formatChapterEvents,
} from "./tools";
import type { ScriptAgentContext } from "./types";

const MAX_ATTEMPTS = 3;
const SCRIPT_MAX_TOKENS = 8192;

export async function runAdaptationStrategyAgent(
  ctx: ScriptAgentContext,
): Promise<string> {
  const baseUserContent = [
    buildProjectConfigBlock(ctx.project),
    `\n总章节数：${ctx.chapters.length}`,
    "\n## 故事骨架\n",
    ctx.workData.storySkeleton,
    "\n## 章节事件表\n",
    formatChapterEvents(ctx.chapters),
    "\n请基于故事骨架制定改编策略，并按 XML 格式输出 <adaptationStrategy>。",
  ].join("\n");

  let lastError = "改编策略 Agent 未返回有效的 <adaptationStrategy> 内容";

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
            baseUserContent + buildXmlRetryHint("adaptationStrategy", attempt),
        },
      ],
      ctx.signal,
      "script-adaptation",
      { maxTokens: SCRIPT_MAX_TOKENS },
    );

    const strategy = parseTaggedAgentOutput(
      stripThink(raw),
      "adaptationStrategy",
    );
    if (strategy) {
      return strategy;
    }

    lastError = `改编策略 Agent 未返回有效的 <adaptationStrategy> 内容（尝试 ${attempt + 1}/${MAX_ATTEMPTS}）`;
  }

  throw new Error(lastError);
}
