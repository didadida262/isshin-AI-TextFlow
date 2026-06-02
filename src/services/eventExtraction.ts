import type { AppConfig } from "../types";
import { EVENT_EXTRACTION_PROMPT } from "../prompts/eventExtraction";
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

function buildUserMessage(chapter: NovelChapterRecord): string {
  return (
    "请根据以下小说章节数：" +
    chapter.chapterIndex +
    "小说章节卷：" +
    chapter.reel +
    "小说章节名称：" +
    chapter.chapter +
    "、小说章节内容生成事件摘要：\n" +
    chapter.chapterData
  );
}

async function extractChapterEvent(
  config: AppConfig,
  model: string,
  chapter: NovelChapterRecord,
  signal?: AbortSignal,
): Promise<NovelChapterRecord> {
  try {
    const raw = await chatCompletion(
      config,
      model,
      [
        { role: "system", content: EVENT_EXTRACTION_PROMPT },
        { role: "user", content: buildUserMessage(chapter) },
      ],
      signal,
      "event-extraction",
    );
    const event = stripThink(raw);
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
  concurrency = 3,
): Promise<NovelChapterRecord[]> {
  if (chapters.length === 0) return [];

  const results: NovelChapterRecord[] = new Array(chapters.length);
  let completed = 0;
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < chapters.length) {
      if (signal?.aborted) return;
      const current = nextIndex++;
      const chapter = chapters[current];
      const result = await extractChapterEvent(config, model, chapter, signal);
      results[current] = result;
      completed += 1;
      onProgress?.({ completed, total: chapters.length, latest: result });
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, chapters.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
