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

function stripXmlDecorations(text: string): string {
  return text
    .replace(/<\/[^>]+>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildMarkdownRetryHint(
  firstHeading: string,
  sectionList: string,
  attempt: number,
): string {
  if (attempt === 0) return "";
  return (
    `\n\n【重要】上次输出格式无效。思路阐述之后必须用 Markdown 输出正文，` +
    `以 \`## ${firstHeading}\` 开头，依次包含：${sectionList}。` +
    "禁止 XML/HTML 标签，禁止用 ``` 代码块包裹正文。"
  );
}

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

/** Parse adaptation strategy: Markdown-first; legacy XML is stripped to plain text. */
export function parseAdaptationStrategyOutput(
  text: string,
  minLength = 200,
): string | null {
  return parseMarkdownFirstTaggedOutput(
    text,
    "adaptationStrategy",
    STRATEGY_MARKERS,
    minLength,
  );
}

/** Parse story skeleton: Markdown-first; legacy XML is stripped to plain text. */
export function parseStorySkeletonOutput(
  text: string,
  minLength = 200,
): string | null {
  return parseMarkdownFirstTaggedOutput(
    text,
    "storySkeleton",
    SKELETON_MARKERS,
    minLength,
  );
}

function parseMarkdownFirstTaggedOutput(
  text: string,
  tagName: string,
  markerPattern: RegExp,
  minLength: number,
): string | null {
  const normalized = stripMarkdownCodeFences(text.trim());

  const markdown = extractMarkdownFallback(normalized, markerPattern, minLength);
  if (markdown) {
    return stripXmlDecorations(markdown);
  }

  const xml = extractXmlTag(normalized, tagName);
  const unclosed = extractUnclosedXmlTag(normalized, tagName);
  const legacyBody = xml ?? unclosed;
  if (legacyBody) {
    const stripped = stripXmlDecorations(legacyBody);
    const fromLegacy = extractMarkdownFallback(stripped, markerPattern, minLength);
    if (fromLegacy) return stripXmlDecorations(fromLegacy);
    if (stripped.length >= minLength) return stripped;
  }

  return null;
}

function formatTaggedAgentDisplay(
  stored: string,
  parse: (text: string, minLength: number) => string | null,
): string {
  const trimmed = stored.trim();
  if (!trimmed) return trimmed;

  const parsed = parse(trimmed, 50);
  if (parsed) return parsed;

  if (/<[a-z][\w.-]*(\s|>)/i.test(trimmed)) {
    return stripXmlDecorations(trimmed);
  }

  return trimmed;
}

/** Normalize stored strategy for workspace display (handles older XML-shaped records). */
export function formatAdaptationStrategyDisplay(stored: string): string {
  return formatTaggedAgentDisplay(stored, parseAdaptationStrategyOutput);
}

/** Normalize stored skeleton for workspace display (handles older XML-shaped records). */
export function formatStorySkeletonDisplay(stored: string): string {
  return formatTaggedAgentDisplay(stored, parseStorySkeletonOutput);
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
