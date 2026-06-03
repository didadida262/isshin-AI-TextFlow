import { invoke } from "@tauri-apps/api/core";

export interface NovelChapterRecord {
  id: number;
  projectId: string;
  chapterIndex: number;
  reel: string;
  chapter: string;
  chapterData: string;
  eventState: number;
  event: string | null;
  errorReason: string | null;
}

export interface NovelSourceRecord {
  projectId: string;
  sourceText: string;
  charCount: number;
  importedAt: number;
  eventExtractionDurationMs: number | null;
}

export interface ImportNovelResult {
  chapterCount: number;
  charCount: number;
}

/** event_state: 0=待提取, 1=成功, 2=失败 */
export const EVENT_STATE_PENDING = 0;
export const EVENT_STATE_SUCCESS = 1;
export const EVENT_STATE_ERROR = 2;

export function isEventExtractionComplete(
  chapters: NovelChapterRecord[],
): boolean {
  return (
    chapters.length > 0 &&
    chapters.every((chapter) => chapter.eventState === EVENT_STATE_SUCCESS)
  );
}

export async function importNovel(
  projectId: string,
  sourceText: string,
): Promise<ImportNovelResult> {
  return invoke<ImportNovelResult>("import_novel", { projectId, sourceText });
}

export async function getNovelSource(
  projectId: string,
): Promise<NovelSourceRecord | null> {
  return invoke<NovelSourceRecord | null>("get_novel_source", { projectId });
}

export async function listNovelChapters(
  projectId: string,
): Promise<NovelChapterRecord[]> {
  return invoke<NovelChapterRecord[]>("list_novel_chapters", { projectId });
}

export async function updateNovelChapterEvent(
  id: number,
  event: string | null,
  errorReason: string | null,
  eventState: number,
): Promise<void> {
  await invoke("update_novel_chapter_event", {
    input: { id, event, errorReason, eventState },
  });
}

export async function setEventExtractionDuration(
  projectId: string,
  durationMs: number,
): Promise<void> {
  await invoke("set_event_extraction_duration", {
    input: { projectId, durationMs },
  });
}

export async function beginEventExtraction(projectId: string): Promise<void> {
  await invoke("begin_event_extraction", { projectId });
}
