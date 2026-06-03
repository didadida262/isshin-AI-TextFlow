import { EPISODE_SCRIPT_PROMPT } from "../../prompts/workflowAgent/episodeScript";
import { chatCompletion } from "../../services/chat";
import type { NovelChapterRecord } from "../../services/novel";
import { stripThink } from "../../utils/stripThink";
import { parseEpisodeScriptOutput } from "../../utils/xmlTags";
import {
  buildProjectConfigBlock,
  episodeName,
  formatChapterEventsByIndexes,
  getChapterText,
  getPreviousScript,
} from "./tools";
import type { ScriptAgentContext } from "./types";

export interface EpisodeScriptResult {
  name: string;
  content: string;
}

const MAX_ATTEMPTS = 3;

function buildRetryHint(attempt: number): string {
  if (attempt === 0) return "";
  return (
    "\n\n【重要】上次输出格式无效。你必须输出一对完整的 XML 标签：" +
    `<scriptItem name="剧本名称">完整剧本正文</scriptItem>，` +
    "标签内是完整剧本，不要用 markdown 代码块包裹 XML。"
  );
}

export async function runEpisodeScriptAgent(
  ctx: ScriptAgentContext,
  chapter: NovelChapterRecord,
): Promise<EpisodeScriptResult> {
  const episodeIndex = chapter.chapterIndex;
  const prevScript = getPreviousScript(ctx.scripts, episodeIndex);
  const expectedName = episodeName(
    ctx.project.name,
    episodeIndex,
    chapter.chapter,
  );

  const baseUserContent = [
    buildProjectConfigBlock(ctx.project),
    `\n当前任务：编写第 ${episodeIndex} 集剧本（对应第 ${episodeIndex} 章《${chapter.chapter}》）`,
    `\n剧本名称（name 属性）：${expectedName}`,
    "\n## 故事骨架\n",
    ctx.workData.storySkeleton,
    "\n## 改编策略\n",
    ctx.workData.adaptationStrategy,
    "\n## 本章事件\n",
    formatChapterEventsByIndexes(ctx.chapters, [episodeIndex]),
    "\n## 本章原文\n",
    getChapterText(ctx.chapters, episodeIndex),
    prevScript
      ? `\n## 上一集剧本（衔接参考）\n${prevScript.content}`
      : "",
    `\n请编写本集完整剧本，使用 <scriptItem name="${expectedName}"> 包裹正文。`,
  ].join("\n");

  let lastError = `第 ${episodeIndex} 集剧本 Agent 未返回有效的 <scriptItem>`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (ctx.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const raw = await chatCompletion(
      ctx.config,
      ctx.model,
      [
        { role: "system", content: EPISODE_SCRIPT_PROMPT },
        {
          role: "user",
          content: baseUserContent + buildRetryHint(attempt),
        },
      ],
      ctx.signal,
      "script-episode",
      { maxTokens: 8192 },
    );

    const parsed = parseEpisodeScriptOutput(stripThink(raw), expectedName);
    if (parsed?.content) {
      return {
        name: parsed.name || expectedName,
        content: parsed.content,
      };
    }

    lastError = `第 ${episodeIndex} 集剧本 Agent 未返回有效的 <scriptItem>（尝试 ${attempt + 1}/${MAX_ATTEMPTS}）`;
  }

  throw new Error(lastError);
}
