function stripMarkdownCodeFences(text: string): string {
  return text
    .replace(/```(?:xml|markdown|md)?\s*\n?([\s\S]*?)```/gi, "$1")
    .trim();
}

export function extractXmlTag(text: string, tagName: string): string | null {
  const normalized = stripMarkdownCodeFences(text);
  const pattern = new RegExp(
    `<${tagName}(\\s+[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );
  const match = normalized.match(pattern);
  return match?.[2]?.trim() ?? null;
}

export function buildXmlRetryHint(tagName: string, attempt: number): string {
  if (attempt === 0) return "";
  return (
    `\n\n【重要】上次输出格式无效。你必须在思路阐述之后，输出一对完整的 XML 标签：` +
    `<${tagName}>…完整正文…</${tagName}>，` +
    "标签内须包含全部必填章节，不要用 markdown 代码块包裹 XML，不要省略闭合标签。"
  );
}

const SKELETON_MARKERS = /(?:\*\*故事核\*\*|##\s*故事核|#\s*故事骨架|三幕结构)/i;
const STRATEGY_MARKERS = /(?:\*\*改编基调\*\*|##\s*改编基调|#\s*改编策略|分集脚本指引)/i;

function extractUnclosedXmlTag(text: string, tagName: string): string | null {
  const pattern = new RegExp(`<${tagName}(\\s+[^>]*)?>([\\s\\S]+)$`, "i");
  const match = text.match(pattern);
  return match?.[2]?.trim() ?? null;
}

function extractMarkdownFallback(
  text: string,
  markerPattern: RegExp,
  minLength: number,
): string | null {
  const match = text.match(markerPattern);
  if (match?.index == null) return null;
  const body = text.slice(match.index).trim();
  return body.length >= minLength ? body : null;
}

/** Parse skeleton / strategy agent output with XML-first and markdown fallbacks. */
export function parseTaggedAgentOutput(
  text: string,
  tagName: "storySkeleton" | "adaptationStrategy",
  minLength = 200,
): string | null {
  const normalized = stripMarkdownCodeFences(text.trim());
  const markerPattern =
    tagName === "storySkeleton" ? SKELETON_MARKERS : STRATEGY_MARKERS;

  const xml = extractXmlTag(normalized, tagName);
  if (xml && xml.length >= minLength) return xml;

  const unclosed = extractUnclosedXmlTag(normalized, tagName);
  if (unclosed && unclosed.length >= minLength) return unclosed;

  return extractMarkdownFallback(normalized, markerPattern, minLength);
}

export interface ScriptItemPayload {
  name: string;
  content: string;
}

export function extractScriptItems(text: string): ScriptItemPayload[] {
  const items: ScriptItemPayload[] = [];
  const patterns = [
    /<scriptItem\s+name="([^"]*)">([\s\S]*?)<\/scriptItem>/gi,
    /<scriptItem\s+name='([^']*)'>([\s\S]*?)<\/scriptItem>/gi,
    /<scriptitem\s+name="([^"]*)">([\s\S]*?)<\/scriptitem>/gi,
    /<scriptitem\s+name='([^']*)'>([\s\S]*?)<\/scriptitem>/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const content = match[2].trim();
      if (content) {
        items.push({ name: match[1].trim(), content });
      }
    }
    if (items.length > 0) break;
  }

  if (items.length === 0) {
    const unclosed = text.match(
      /<scriptItem\s+name=["']([^"']*)["']\s*>([\s\S]+)/i,
    );
    if (unclosed?.[2]?.trim()) {
      items.push({
        name: unclosed[1].trim(),
        content: unclosed[2].trim(),
      });
    }
  }

  return items;
}

/** Fallback when the model outputs markdown script without XML wrappers. */
export function extractScriptMarkdownFallback(
  text: string,
  expectedName: string,
): ScriptItemPayload | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const escapedName = expectedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const namedHeading = new RegExp(`#\\s*${escapedName}\\s*`, "i");
  const namedMatch = trimmed.match(namedHeading);
  if (namedMatch?.index != null) {
    const content = trimmed.slice(namedMatch.index).trim();
    if (content.length >= 80) {
      return { name: expectedName, content };
    }
  }

  const epMatch = trimmed.match(/#\s*.+?\bEP\s*\d+[^\n]*/i);
  if (epMatch?.index != null) {
    const content = trimmed.slice(epMatch.index).trim();
    if (content.length >= 80) {
      const title = epMatch[0].replace(/^#\s*/, "").trim();
      return { name: title || expectedName, content };
    }
  }

  return null;
}

export function parseEpisodeScriptOutput(
  text: string,
  expectedName: string,
): ScriptItemPayload | null {
  const items = extractScriptItems(text);
  const item = items.find((entry) => entry.content.length > 0) ?? items[0];
  if (item?.content) {
    return {
      name: item.name || expectedName,
      content: item.content,
    };
  }

  return extractScriptMarkdownFallback(text, expectedName);
}
