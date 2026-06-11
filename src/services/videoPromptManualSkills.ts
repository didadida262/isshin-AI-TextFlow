import {
  loadArtSkillDetail,
  loadDirectorManualDetail,
  type SkillDetail,
} from "./skills";

/** Director manual tab: 分镜表 */
export const DIRECTOR_STORYBOARD_TABLE_TAB = "director_storyboard_table_narrative";

/** Visual manual tab: 分镜 */
export const VISUAL_STORYBOARD_TAB = "director_storyboard";

export interface VideoPromptManualSkills {
  directorStoryboardTable: string;
  visualStoryboard: string;
}

const directorManualDetailCache = new Map<string, SkillDetail>();
const artSkillDetailCache = new Map<string, SkillDetail>();

function stripYamlFrontmatter(markdown: string): string {
  return markdown.replace(/^---[\s\S]*?---\s*\n?/, "").trim();
}

function readTabContent(
  detail: SkillDetail | null,
  tabValue: string,
): string {
  if (!detail) return "";
  const tab = detail.tabs.find((item) => item.value === tabValue);
  if (!tab?.content.trim()) return "";
  return stripYamlFrontmatter(tab.content);
}

async function loadDirectorManualDetailCached(
  directorManualId: string,
): Promise<SkillDetail | null> {
  const cached = directorManualDetailCache.get(directorManualId);
  if (cached) return cached;

  const detail = await loadDirectorManualDetail(directorManualId);
  if (!detail) return null;

  directorManualDetailCache.set(directorManualId, detail);
  return detail;
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

/** Load director storyboard-table + visual storyboard skills for video prompt generation. */
export async function loadVideoPromptManualSkills(
  directorManualId: string | undefined,
  artStyleId: string | undefined,
): Promise<VideoPromptManualSkills> {
  const directorId = directorManualId?.trim() ?? "";
  const artId = artStyleId?.trim() ?? "";

  const [directorDetail, artDetail] = await Promise.all([
    directorId ? loadDirectorManualDetailCached(directorId) : Promise.resolve(null),
    artId ? loadArtSkillDetailCached(artId) : Promise.resolve(null),
  ]);

  return {
    directorStoryboardTable: readTabContent(
      directorDetail,
      DIRECTOR_STORYBOARD_TABLE_TAB,
    ),
    visualStoryboard: readTabContent(artDetail, VISUAL_STORYBOARD_TAB),
  };
}
