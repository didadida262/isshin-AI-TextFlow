import type { AppConfig } from "../types";
import { EVENT_EXTRACTION_PROMPT } from "../prompts/workflowAgent/eventExtraction";
import { chatCompletion } from "./chat";
import {
  EVENT_STATE_ERROR,
  EVENT_STATE_SUCCESS,
  type NovelChapterRecord,
  updateNovelChapterEvent,
} from "./novel";
import { stripThink } from "../utils/stripThink";

export interface ExtractEventsProgress {
  completed: number;
  total: number;
  latest?: NovelChapterRecord;
}

/** Stay below typical gateway / proxy body limits when sending chapter text. */
const MAX_CHAPTER_CHARS = 18_000;

/** Parallel LLM requests while extracting events (balance speed vs API rate limits). */
export const DEFAULT_EVENT_EXTRACTION_CONCURRENCY = 6;

function isChapterEventExtracted(chapter: NovelChapterRecord): boolean {
  return chapter.eventState === EVENT_STATE_SUCCESS;
}

function buildUserMessage(chapter: NovelChapterRecord, chapterData: string): string {
  return (
    "请根据以下小说章节数：" +
    chapter.chapterIndex +
    "小说章节卷：" +
    chapter.reel +
    "小说章节名称：" +
    chapter.chapter +
    "、小说章节内容生成事件摘要：\n" +
    chapterData
  );
}

function splitChapterContent(text: string, maxChars: number): string[] {
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

function parseEventFields(event: string): string[] | null {
  const trimmed = event.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const parts = trimmed
    .slice(1, -1)
    .split("|")
    .map((part) => part.trim());
  return parts.length === 7 ? parts : null;
}

function mergeEventRows(events: string[]): string {
  const parsed = events
    .map(parseEventFields)
    .filter((fields): fields is string[] => fields != null);
  if (parsed.length === 0) return events[0] ?? "";
  if (parsed.length === 1) {
    return `| ${parsed[0].join(" | ")} |`;
  }

  const [first] = parsed;
  const roles = [
    ...new Set(parsed.flatMap((fields) => fields[1].split("、").map((r) => r.trim()))),
  ].filter(Boolean);
  const coreEvents = parsed.map((fields) => fields[2]).filter(Boolean);
  const relationRank = (value: string) =>
    value.startsWith("强") ? 3 : value.startsWith("中") ? 2 : 1;
  const densityRank = (value: string) =>
    value === "高" ? 3 : value === "中" ? 2 : 1;
  const bestRelation = parsed.reduce((best, fields) =>
    relationRank(fields[3]) > relationRank(best[3]) ? fields : best,
  )[3];
  const bestDensity = parsed.reduce((best, fields) =>
    densityRank(fields[4]) > densityRank(best[4]) ? fields : best,
  )[4];
  const durations = parsed
    .map((fields) => Number.parseInt(fields[5].replace(/[^\d]/g, ""), 10))
    .filter((value) => Number.isFinite(value));
  const totalSeconds = durations.reduce((sum, value) => sum + value, 0);
  const emotions = [
    ...new Set(parsed.flatMap((fields) => fields[6].split("+").map((e) => e.trim()))),
  ].filter(Boolean);

  return `| ${first[0]} | ${roles.join("、")} | ${coreEvents.join("；")} | ${bestRelation} | ${bestDensity} | ${totalSeconds || first[5]} | ${emotions.join("+")} |`;
}

async function requestChapterEvent(
  config: AppConfig,
  model: string,
  chapter: NovelChapterRecord,
  chapterData: string,
  signal?: AbortSignal,
): Promise<string> {
  const raw = await chatCompletion(
    config,
    model,
    [
      { role: "system", content: EVENT_EXTRACTION_PROMPT },
      { role: "user", content: buildUserMessage(chapter, chapterData) },
    ],
    signal,
    "event-extraction",
  );
  return stripThink(raw);
}

async function extractChapterEvent(
  config: AppConfig,
  model: string,
  chapter: NovelChapterRecord,
  signal?: AbortSignal,
): Promise<NovelChapterRecord> {
  try {
    const chunks = splitChapterContent(chapter.chapterData, MAX_CHAPTER_CHARS);
    const events: string[] = [];
    for (const chunk of chunks) {
      events.push(
        await requestChapterEvent(config, model, chapter, chunk, signal),
      );
    }
    const event = mergeEventRows(events);
    await updateNovelChapterEvent(
      chapter.id,
      event,
      null,
      EVENT_STATE_SUCCESS,
    );
    return {
      ...chapter,
      event,
      errorReason: null,
      eventState: EVENT_STATE_SUCCESS,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateNovelChapterEvent(
      chapter.id,
      null,
      message,
      EVENT_STATE_ERROR,
    );
    return {
      ...chapter,
      event: null,
      errorReason: message,
      eventState: EVENT_STATE_ERROR,
    };
  }
}

/** Extract events for DB chapters with bounded concurrency; results persisted to SQLite. */
export async function extractEventsForChapters(
  config: AppConfig,
  model: string,
  chapters: NovelChapterRecord[],
  onProgress?: (progress: ExtractEventsProgress) => void,
  signal?: AbortSignal,
  concurrency = DEFAULT_EVENT_EXTRACTION_CONCURRENCY,
): Promise<NovelChapterRecord[]> {
  if (chapters.length === 0) return [];

  const results = [...chapters];
  const pendingIndices: number[] = [];
  let completed = 0;

  for (let index = 0; index < chapters.length; index += 1) {
    if (isChapterEventExtracted(chapters[index])) {
      completed += 1;
    } else {
      pendingIndices.push(index);
    }
  }

  if (completed > 0) {
    onProgress?.({ completed, total: chapters.length });
  }

  if (pendingIndices.length === 0) {
    return results;
  }

  let nextPending = 0;

  const worker = async () => {
    while (nextPending < pendingIndices.length) {
      if (signal?.aborted) return;
      const chapterIndex = pendingIndices[nextPending];
      nextPending += 1;
      const chapter = chapters[chapterIndex];
      const result = await extractChapterEvent(config, model, chapter, signal);
      results[chapterIndex] = result;
      completed += 1;
      onProgress?.({ completed, total: chapters.length, latest: result });
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, pendingIndices.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
