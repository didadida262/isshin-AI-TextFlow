import { ASSET_EXTRACTION_PROMPT } from "../../../prompts/workflowAgent/assetExtraction/prompt";
import { chatCompletion } from "../../../services/chat";
import { truncateImagePrompt } from "../../../services/imageGeneration";
import {
  SCRIPT_STATE_SUCCESS,
  type ScriptRecord,
} from "../../../services/script";
import type { AppConfig } from "../../../types";
import type { ExtractedAsset, ExtractedAssetType } from "../../../utils/extractAssetsFromScript";
import { stripThink } from "../../../utils/stripThink";

export interface ExtractAssetsProgress {
  completed: number;
  total: number;
}

const MAX_SCRIPT_CHARS = 24_000;
const MAX_ATTEMPTS = 3;
const ASSET_EXTRACTION_MAX_TOKENS = 4096;
export const DEFAULT_ASSET_EXTRACTION_CONCURRENCY = 4;

interface RawExtractedAsset {
  name?: unknown;
  assetType?: unknown;
  prompt?: unknown;
}

function normalizeAssetName(name: string): string {
  return name
    .replace(/\*+/g, "")
    .replace(/^[（(]+/, "")
    .replace(/[）)]+$/, "")
    .trim();
}

function normalizeAssetType(value: unknown): ExtractedAssetType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "character" || normalized === "角色") return "character";
  if (normalized === "scene" || normalized === "场景") return "scene";
  return null;
}

function buildUserMessage(script: ScriptRecord, content: string): string {
  return [
    `剧本集数：${script.episodeIndex}`,
    `剧本名称：${script.name}`,
    "剧本正文：",
    content,
    "",
    "请提取本集人物与场景资产，仅输出 JSON 数组。",
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

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  return trimmed;
}

function parseAssetExtractionOutput(raw: string): ExtractedAsset[] {
  const text = stripThink(raw);
  const payload = extractJsonPayload(text);
  const parsed = JSON.parse(payload) as unknown;

  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? ((parsed as { assets?: unknown; items?: unknown }).assets ??
        (parsed as { items?: unknown }).items)
      : null;

  if (!Array.isArray(rows)) {
    throw new Error("模型未返回 JSON 数组");
  }

  const results: ExtractedAsset[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as RawExtractedAsset;
    const name = normalizeAssetName(
      typeof item.name === "string" ? item.name : "",
    );
    const assetType = normalizeAssetType(item.assetType);
    const prompt =
      typeof item.prompt === "string" ? item.prompt.trim() : "";

    if (!name || !assetType || !prompt) continue;
    if (name.includes("集末钩子") || name.includes("剧情梗概")) continue;

    results.push({
      name,
      assetType,
      prompt: truncateImagePrompt(prompt),
      sourceEpisodes: [],
    });
  }

  return results;
}

async function requestEpisodeAssets(
  config: AppConfig,
  model: string,
  script: ScriptRecord,
  scriptContent: string,
  signal?: AbortSignal,
): Promise<ExtractedAsset[]> {
  let lastError = "模型未返回有效资产 JSON";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const retryHint =
      attempt === 0
        ? ""
        : `\n\n上次输出无效（${lastError}）。请严格只输出 JSON 数组，字段为 name、assetType、prompt。`;

    try {
      const raw = await chatCompletion(
        config,
        model,
        [
          { role: "system", content: ASSET_EXTRACTION_PROMPT },
          {
            role: "user",
            content: buildUserMessage(script, scriptContent) + retryHint,
          },
        ],
        signal,
        "asset-extraction",
        { maxTokens: ASSET_EXTRACTION_MAX_TOKENS },
      );

      const assets = parseAssetExtractionOutput(raw).map((asset) => ({
        ...asset,
        sourceEpisodes: [script.episodeIndex],
      }));

      if (assets.length > 0 || attempt === MAX_ATTEMPTS - 1) {
        return assets;
      }

      lastError = "JSON 数组为空";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_ATTEMPTS - 1) throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

async function extractAssetsFromEpisode(
  config: AppConfig,
  model: string,
  script: ScriptRecord,
  signal?: AbortSignal,
): Promise<ExtractedAsset[]> {
  const chunks = splitScriptContent(script.content.trim(), MAX_SCRIPT_CHARS);
  const perChunk = await Promise.all(
    chunks.map((chunk) =>
      requestEpisodeAssets(config, model, script, chunk, signal),
    ),
  );

  return mergeEpisodeChunkAssets(perChunk.flat());
}

function mergeEpisodeChunkAssets(items: ExtractedAsset[]): ExtractedAsset[] {
  const map = new Map<string, ExtractedAsset>();

  for (const item of items) {
    const key = `${item.assetType}:${item.name}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item, sourceEpisodes: [...item.sourceEpisodes] });
      continue;
    }
    if (item.prompt.length > existing.prompt.length) {
      existing.prompt = item.prompt;
    }
  }

  return [...map.values()];
}

export function mergeExtractedAssetsAcrossEpisodes(
  items: ExtractedAsset[],
): ExtractedAsset[] {
  const map = new Map<string, ExtractedAsset>();

  for (const item of items) {
    const key = `${item.assetType}:${item.name}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...item,
        sourceEpisodes: [...item.sourceEpisodes],
      });
      continue;
    }

    if (item.prompt.length > existing.prompt.length) {
      existing.prompt = item.prompt;
    }
    for (const episode of item.sourceEpisodes) {
      if (!existing.sourceEpisodes.includes(episode)) {
        existing.sourceEpisodes.push(episode);
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.assetType !== b.assetType) {
      return a.assetType === "scene" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

export interface ExtractAssetsFromScriptsInput {
  config: AppConfig;
  model: string;
  scripts: ScriptRecord[];
  onProgress?: (progress: ExtractAssetsProgress) => void;
  signal?: AbortSignal;
  concurrency?: number;
}

/** LLM-based extraction of character/scene assets from successful episode scripts. */
export async function extractAssetsFromScriptsWithAgent(
  input: ExtractAssetsFromScriptsInput,
): Promise<ExtractedAsset[]> {
  const {
    config,
    model,
    scripts,
    onProgress,
    signal,
    concurrency = DEFAULT_ASSET_EXTRACTION_CONCURRENCY,
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

  const results: ExtractedAsset[] = [];
  let completed = 0;
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < successful.length) {
      if (signal?.aborted) return;
      const script = successful[nextIndex];
      nextIndex += 1;

      const episodeAssets = await extractAssetsFromEpisode(
        config,
        trimmedModel,
        script,
        signal,
      );
      results.push(...episodeAssets);
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

  return mergeExtractedAssetsAcrossEpisodes(results);
}
