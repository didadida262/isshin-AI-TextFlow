import { VIDEO_PROMPT_GENERATION_SYSTEM } from "../../../prompts/workflowAgent/videoPromptGeneration/prompt";
import { chatCompletion } from "../../../services/chat";
import {
  SCRIPT_STATE_SUCCESS,
  setScriptVideoPrompt,
  type ScriptRecord,
} from "../../../services/script";
import type { AppConfig } from "../../../types";
import { stripThink } from "../../../utils/stripThink";

export interface GenerateVideoPromptsProgress {
  completed: number;
  total: number;
}

const MAX_SCRIPT_CHARS = 24_000;
const MAX_ATTEMPTS = 3;
const VIDEO_PROMPT_MAX_TOKENS = 2048;
export const DEFAULT_VIDEO_PROMPT_CONCURRENCY = 3;

function buildUserMessage(script: ScriptRecord, content: string): string {
  return [
    `剧本集数：${script.episodeIndex}`,
    `剧本名称：${script.name}`,
    "剧本正文：",
    content,
    "",
    "请根据上述剧本生成一条 Seedance 合规文生视频提示词，仅输出提示词正文。",
  ].join("\n");
}

function splitScriptContent(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const paragraphBreak = slice.lastIndexOf("\n\n");
      const lineBreak = slice.lastIndexOf("\n");
      const breakAt =
        paragraphBreak > maxChars * 0.4
          ? start + paragraphBreak + 2
          : lineBreak > maxChars * 0.4
            ? start + lineBreak + 1
            : end;
      end = breakAt;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
  }

  return chunks.length > 0 ? chunks : [text];
}

function normalizePromptOutput(raw: string): string {
  const text = stripThink(raw).trim();
  const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  const lines = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
    .trim();

  return lines.replace(/^提示词[：:]\s*/u, "").trim();
}

async function requestEpisodePrompt(
  config: AppConfig,
  model: string,
  script: ScriptRecord,
  scriptContent: string,
  signal?: AbortSignal,
): Promise<string> {
  let lastError = "模型未返回有效提示词";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const retryHint =
      attempt === 0
        ? ""
        : `\n\n上次输出无效（${lastError}）。请严格只输出一条中文提示词正文，不要任何解释或标记。`;

    try {
      const raw = await chatCompletion(
        config,
        model,
        [
          { role: "system", content: VIDEO_PROMPT_GENERATION_SYSTEM },
          {
            role: "user",
            content: buildUserMessage(script, scriptContent) + retryHint,
          },
        ],
        signal,
        "video-prompt-generation",
        { maxTokens: VIDEO_PROMPT_MAX_TOKENS },
      );

      const prompt = normalizePromptOutput(raw);
      if (prompt.length >= 40) return prompt;
      lastError = "提示词过短";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_ATTEMPTS - 1) throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

async function generatePromptForEpisode(
  config: AppConfig,
  model: string,
  script: ScriptRecord,
  signal?: AbortSignal,
): Promise<string> {
  const chunks = splitScriptContent(script.content.trim(), MAX_SCRIPT_CHARS);
  if (chunks.length === 1) {
    return requestEpisodePrompt(config, model, script, chunks[0], signal);
  }

  const partials = await Promise.all(
    chunks.map((chunk) =>
      requestEpisodePrompt(config, model, script, chunk, signal),
    ),
  );

  return requestEpisodePrompt(
    config,
    model,
    script,
    [
      "以下为长剧本分段生成的候选提示词，请合并为一条 5 秒竖屏合规短片提示词：",
      ...partials.map((p, i) => `【片段${i + 1}】\n${p}`),
    ].join("\n\n"),
    signal,
  );
}

export interface GenerateVideoPromptsInput {
  config: AppConfig;
  model: string;
  scripts: ScriptRecord[];
  onProgress?: (progress: GenerateVideoPromptsProgress) => void;
  onScriptPromptSaved?: (script: ScriptRecord, videoPrompt: string) => void;
  signal?: AbortSignal;
  concurrency?: number;
}

/** LLM-based Seedance-compliant video prompt per successful episode script. */
export async function generateVideoPromptsWithAgent(
  input: GenerateVideoPromptsInput,
): Promise<ScriptRecord[]> {
  const {
    config,
    model,
    scripts,
    onProgress,
    onScriptPromptSaved,
    signal,
    concurrency = DEFAULT_VIDEO_PROMPT_CONCURRENCY,
  } = input;

  const trimmedModel = model.trim();
  if (!trimmedModel) {
    throw new Error("MODEL_REQUIRED");
  }

  const successful = scripts
    .filter(
      (script) =>
        script.scriptState === SCRIPT_STATE_SUCCESS && script.content.trim(),
    )
    .sort((a, b) => a.episodeIndex - b.episodeIndex);

  if (successful.length === 0) return [];

  const updated: ScriptRecord[] = [];
  let completed = 0;
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < successful.length) {
      if (signal?.aborted) return;
      const script = successful[nextIndex];
      nextIndex += 1;

      const videoPrompt = await generatePromptForEpisode(
        config,
        trimmedModel,
        script,
        signal,
      );

      const saved = await setScriptVideoPrompt({
        projectId: script.projectId,
        episodeIndex: script.episodeIndex,
        videoPrompt,
      });

      updated.push(saved);
      onScriptPromptSaved?.(saved, videoPrompt);
      completed += 1;
      onProgress?.({ completed, total: successful.length });
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, successful.length) },
    () => worker(),
  );
  await Promise.all(workers);

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  return updated.sort((a, b) => a.episodeIndex - b.episodeIndex);
}
