import type { AppConfig } from "../types";
import { EVENT_EXTRACTION_PROMPT } from "../prompts/eventExtraction";
import { chatCompletion } from "./chat";
import { stripThink } from "../utils/stripThink";
import {
  splitNovelChapters,
  type NovelChapter,
} from "../utils/splitNovelChapters";

export interface ChapterEventResult {
  chapter: NovelChapter;
  event: string;
  error?: string;
}

export interface ExtractEventsProgress {
  completed: number;
  total: number;
  latest?: ChapterEventResult;
}

function buildUserMessage(chapter: NovelChapter): string {
  return (
    "请根据以下小说章节数：" +
    chapter.index +
    "小说章节卷：" +
    chapter.reel +
    "小说章节名称：" +
    chapter.title +
    "、小说章节内容生成事件摘要：\n" +
    chapter.content
  );
}

async function extractChapterEvent(
  config: AppConfig,
  model: string,
  chapter: NovelChapter,
  signal?: AbortSignal,
): Promise<ChapterEventResult> {
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
    return {
      chapter,
      event: stripThink(raw),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { chapter, event: "", error: message };
  }
}

/** Extract events for all chapters with bounded concurrency. */
export async function extractEventsFromNovel(
  config: AppConfig,
  model: string,
  novelText: string,
  onProgress?: (progress: ExtractEventsProgress) => void,
  signal?: AbortSignal,
  concurrency = 3,
): Promise<ChapterEventResult[]> {
  const chapters = splitNovelChapters(novelText);
  if (chapters.length === 0) return [];

  const results: ChapterEventResult[] = new Array(chapters.length);
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
