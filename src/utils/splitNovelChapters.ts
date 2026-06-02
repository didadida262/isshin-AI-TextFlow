export interface NovelChapter {
  index: number;
  reel: string;
  title: string;
  content: string;
}

const CHAPTER_HEADING =
  /第\s*[0-9一二三四五六七八九十百千万]+\s*章[^\n\r]*/g;

const REEL_HEADING =
  /第\s*[0-9一二三四五六七八九十百千万]+\s*[卷部篇][^\n\r]*/;

function parseChapterTitle(heading: string): string {
  const trimmed = heading.trim();
  const withoutPrefix = trimmed.replace(
    /^第\s*[0-9一二三四五六七八九十百千万]+\s*章\s*/,
    "",
  );
  return withoutPrefix || trimmed;
}

function detectReel(text: string, beforeIndex: number): string {
  const prefix = text.slice(0, beforeIndex);
  const matches = [...prefix.matchAll(new RegExp(REEL_HEADING.source, "g"))];
  if (matches.length === 0) return "正文卷";
  return matches[matches.length - 1][0].trim();
}

/** Split novel text into chapters by common Chinese chapter headings. */
export function splitNovelChapters(text: string): NovelChapter[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const matches = [...normalized.matchAll(CHAPTER_HEADING)];
  if (matches.length === 0) {
    return [
      {
        index: 1,
        reel: detectReel(normalized, 0),
        title: "第一章",
        content: normalized,
      },
    ];
  }

  const chapters: NovelChapter[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index ?? 0;
    const heading = match[0];
    const bodyStart = start + heading.length;
    const bodyEnd =
      i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
    const content = normalized.slice(bodyStart, bodyEnd).trim();

    chapters.push({
      index: i + 1,
      reel: detectReel(normalized, start),
      title: parseChapterTitle(heading),
      content: content || heading,
    });
  }

  return chapters;
}
