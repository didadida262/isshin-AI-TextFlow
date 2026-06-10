export type ExtractedAssetType = "character" | "scene";

export interface ExtractedAsset {
  name: string;
  assetType: ExtractedAssetType;
  prompt: string;
  sourceEpisodes: number[];
}

const SCENE_HEADER_RE =
  /^##\s*场景\s*\d+\s*·\s*(内\/外|内|外)\s*·\s*(.+?)\s*·\s*(日|夜|晨|昏|傍晚|清晨|白天|夜晚)/;

const ACTION_LINE_RE = /^△\s*(.+)$/;

const DIALOGUE_LINE_RE = /^([^#\s△][^：:\n]{0,30})[：:]\s*.+$/;

const SKIP_SPEAKER_NAMES = new Set([
  "剧情梗概",
  "旁白",
  "画外音",
  "字幕",
  "场景",
  "OS",
  "VO",
  "os",
  "vo",
]);

function buildScenePrompt(
  io: string,
  location: string,
  time: string,
  descriptions: string[],
): string {
  const visual = descriptions.join("，");
  const parts = [io, location, time, visual, "电影级画面，高清细节，短剧风格"].filter(
    Boolean,
  );
  return parts.join("，");
}

function buildCharacterPrompt(name: string, context: string[]): string {
  const visual = context.length > 0 ? context.join("，") : "短剧角色";
  return `${name}，${visual}，人物立绘，半身像，高清细节，短剧风格`;
}

function parseSceneHeader(line: string): {
  io: string;
  location: string;
  time: string;
} | null {
  const match = line.trim().match(SCENE_HEADER_RE);
  if (!match) return null;
  return {
    io: match[1].trim(),
    location: match[2].trim(),
    time: match[3].trim(),
  };
}

function isSkippableLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed === "---") return true;
  if (parseSceneHeader(trimmed)) return false;
  if (/^#{1,2}\s/.test(trimmed)) return true;
  return false;
}

/** Extract scene and character assets from a single episode script body. */
export function extractAssetsFromScript(
  content: string,
  episodeIndex: number,
): ExtractedAsset[] {
  const lines = content.split(/\r?\n/);
  const assets: ExtractedAsset[] = [];

  let sceneHeader: { io: string; location: string; time: string } | null = null;
  let sceneDescriptions: string[] = [];
  const sceneCharacters = new Map<string, string[]>();

  const flushScene = () => {
    if (!sceneHeader) return;

    const locationName = sceneHeader.location;
    if (locationName) {
      assets.push({
        name: locationName,
        assetType: "scene",
        prompt: buildScenePrompt(
          sceneHeader.io,
          locationName,
          sceneHeader.time,
          sceneDescriptions,
        ),
        sourceEpisodes: [episodeIndex],
      });
    }

    for (const [name, context] of sceneCharacters) {
      assets.push({
        name,
        assetType: "character",
        prompt: buildCharacterPrompt(name, context),
        sourceEpisodes: [episodeIndex],
      });
    }

    sceneHeader = null;
    sceneDescriptions = [];
    sceneCharacters.clear();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (isSkippableLine(line)) continue;

    const scene = parseSceneHeader(line);
    if (scene) {
      flushScene();
      sceneHeader = scene;
      continue;
    }

    const actionMatch = line.match(ACTION_LINE_RE);
    if (actionMatch) {
      sceneDescriptions.push(actionMatch[1].trim());
      continue;
    }

    const dialogueMatch = line.match(DIALOGUE_LINE_RE);
    if (dialogueMatch) {
      const speaker = dialogueMatch[1].trim();
      if (SKIP_SPEAKER_NAMES.has(speaker)) continue;
      const existing = sceneCharacters.get(speaker) ?? [];
      if (sceneDescriptions.length > 0) {
        existing.push(...sceneDescriptions.slice(-2));
      }
      sceneCharacters.set(speaker, existing);
    }
  }

  flushScene();
  return assets;
}

function mergePrompt(existing: string, incoming: string): string {
  if (existing === incoming) return existing;
  if (existing.includes(incoming)) return existing;
  if (incoming.includes(existing)) return incoming;
  return `${existing}；${incoming}`;
}

/** Deduplicate extracted assets by name and type across episodes. */
export function mergeExtractedAssets(items: ExtractedAsset[]): ExtractedAsset[] {
  const map = new Map<string, ExtractedAsset>();

  for (const item of items) {
    const key = `${item.assetType}:${item.name}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item, sourceEpisodes: [...item.sourceEpisodes] });
      continue;
    }

    existing.prompt = mergePrompt(existing.prompt, item.prompt);
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
