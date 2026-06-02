import type { NovelChapterRecord } from "../../services/novel";
import type { ScriptRecord } from "../../services/script";
import type { CreationProject } from "../../types";

export function buildProjectConfigBlock(project: CreationProject): string {
  return [
    "## 项目配置",
    `作品名称：${project.name}`,
    `小说类型：${project.novelType}`,
    `作品简介：${project.intro || "无"}`,
    `画风/视觉：${project.artStyle || "无"}`,
    `画幅比例：${project.aspectRatio || "16:9"}`,
  ].join("\n");
}

export function formatChapterEvents(chapters: NovelChapterRecord[]): string {
  if (chapters.length === 0) return "（无章节事件）";
  return chapters
    .map(
      (chapter) =>
        `第${chapter.chapterIndex}章《${chapter.chapter}》事件：${chapter.event ?? "—"}`,
    )
    .join("\n");
}

export function formatChapterEventsByIndexes(
  chapters: NovelChapterRecord[],
  indexes: number[],
): string {
  const selected = chapters.filter((chapter) =>
    indexes.includes(chapter.chapterIndex),
  );
  return formatChapterEvents(selected);
}

export function getChapterText(
  chapters: NovelChapterRecord[],
  chapterIndex: number,
): string {
  const chapter = chapters.find((item) => item.chapterIndex === chapterIndex);
  return chapter?.chapterData ?? "";
}

export function getPreviousScript(
  scripts: ScriptRecord[],
  episodeIndex: number,
): ScriptRecord | null {
  if (episodeIndex <= 1) return null;
  return (
    scripts.find((script) => script.episodeIndex === episodeIndex - 1) ?? null
  );
}

export function episodeName(projectName: string, episodeIndex: number, chapterTitle: string): string {
  const ep = String(episodeIndex).padStart(2, "0");
  return `${projectName} EP${ep}：${chapterTitle}`;
}
