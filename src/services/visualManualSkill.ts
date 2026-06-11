import { loadArtSkillDetail, type SkillDetail } from "./skills";

/** Visual manual tab id for each asset type when generating images. */
const ASSET_TYPE_SKILL_TAB: Record<string, string> = {
  character: "art_character",
  scene: "art_scene",
  prop: "art_prop",
};

const artSkillDetailCache = new Map<string, SkillDetail>();

function stripYamlFrontmatter(markdown: string): string {
  return markdown.replace(/^---[\s\S]*?---\s*\n?/, "").trim();
}

async function loadArtSkillDetailCached(
  artStyleId: string,
): Promise<SkillDetail | null> {
  const cached = artSkillDetailCache.get(artStyleId);
  if (cached) return cached;

  const detail = await loadArtSkillDetail(artStyleId);
  if (!detail) return null;

  artSkillDetailCache.set(artStyleId, detail);
  return detail;
}

/** Load the visual-manual skill block for an asset type (not shown in UI). */
export async function loadVisualManualSkillPrefix(
  artStyleId: string,
  assetType: string,
): Promise<string> {
  const tabValue = ASSET_TYPE_SKILL_TAB[assetType];
  if (!tabValue || !artStyleId.trim()) return "";

  const detail = await loadArtSkillDetailCached(artStyleId.trim());
  if (!detail) return "";

  const tab = detail.tabs.find((item) => item.value === tabValue);
  if (!tab?.content.trim()) return "";

  return stripYamlFrontmatter(tab.content);
}

export interface VisualManualExtractionSkills {
  character: string;
  scene: string;
  prop: string;
}

/** Load character/scene/prop skills for asset-extraction agent (not shown in UI). */
export async function loadVisualManualExtractionSkills(
  artStyleId: string | undefined,
): Promise<VisualManualExtractionSkills> {
  if (!artStyleId?.trim()) {
    return { character: "", scene: "", prop: "" };
  }

  const [character, scene, prop] = await Promise.all([
    loadVisualManualSkillPrefix(artStyleId, "character"),
    loadVisualManualSkillPrefix(artStyleId, "scene"),
    loadVisualManualSkillPrefix(artStyleId, "prop"),
  ]);

  return { character, scene, prop };
}

/** Prepend project visual-manual skill before the user prompt for image APIs. */
export async function buildAssetGenerationPrompt(
  userPrompt: string,
  artStyleId: string | undefined,
  assetType: string,
): Promise<string> {
  const body = userPrompt.trim();
  if (!artStyleId?.trim() || !body) return body;

  const prefix = await loadVisualManualSkillPrefix(artStyleId, assetType);
  if (!prefix) return body;

  return `${prefix}\n\n---\n\n${body}`;
}
