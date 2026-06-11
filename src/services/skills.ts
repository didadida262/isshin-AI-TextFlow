import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export interface SkillManualItem {
  id: string;
  name: string;
  subtitle: string;
  coverPath: string | null;
  coverUrl: string | null;
}

export interface SkillTab {
  label: string;
  value: string;
  content: string;
}

export interface SkillDetail {
  id: string;
  name: string;
  subtitle: string;
  coverPath: string | null;
  coverUrl: string | null;
  imageUrls: string[];
  tabs: SkillTab[];
}

interface RawSkillManualItem {
  id: string;
  name: string;
  subtitle: string;
  coverPath: string | null;
}

interface RawSkillDetail {
  id: string;
  name: string;
  subtitle: string;
  coverPath: string | null;
  imagePaths: string[];
  tabs: SkillTab[];
}

function mapSkillItem(item: RawSkillManualItem): SkillManualItem {
  return {
    ...item,
    coverUrl: item.coverPath ? convertFileSrc(item.coverPath) : null,
  };
}

function mapSkillDetail(detail: RawSkillDetail): SkillDetail {
  return {
    id: detail.id,
    name: detail.name,
    subtitle: detail.subtitle,
    coverPath: detail.coverPath,
    coverUrl: detail.coverPath ? convertFileSrc(detail.coverPath) : null,
    imageUrls: detail.imagePaths.map((path) => convertFileSrc(path)),
    tabs: detail.tabs,
  };
}

export async function loadArtSkills(): Promise<SkillManualItem[]> {
  try {
    const items = await invoke<RawSkillManualItem[]>("list_art_skills");
    return items.map(mapSkillItem);
  } catch (error) {
    console.error("[skills] loadArtSkills failed:", error);
    return [];
  }
}

export async function loadStorySkills(): Promise<SkillManualItem[]> {
  try {
    const items = await invoke<RawSkillManualItem[]>("list_story_skills");
    return items.map(mapSkillItem);
  } catch (error) {
    console.error("[skills] loadStorySkills failed:", error);
    return [];
  }
}

export async function loadArtSkillDetail(id: string): Promise<SkillDetail | null> {
  try {
    const detail = await invoke<RawSkillDetail>("get_art_skill_detail", { id });
    return mapSkillDetail(detail);
  } catch (error) {
    console.error("[skills] loadArtSkillDetail failed:", error);
    return null;
  }
}

export async function loadStorySkillDetail(id: string): Promise<SkillDetail | null> {
  try {
    const detail = await invoke<RawSkillDetail>("get_story_skill_detail", { id });
    return mapSkillDetail(detail);
  } catch (error) {
    console.error("[skills] loadStorySkillDetail failed:", error);
    return null;
  }
}

export async function loadDirectorManuals(): Promise<SkillManualItem[]> {
  try {
    const items = await invoke<RawSkillManualItem[]>("list_director_manuals");
    return items.map(mapSkillItem);
  } catch (error) {
    console.error("[skills] loadDirectorManuals failed:", error);
    return [];
  }
}

export async function loadDirectorManualDetail(
  id: string,
): Promise<SkillDetail | null> {
  try {
    const detail = await invoke<RawSkillDetail>("get_director_manual_detail", {
      id,
    });
    return mapSkillDetail(detail);
  } catch (error) {
    console.error("[skills] loadDirectorManualDetail failed:", error);
    return null;
  }
}

export async function loadDirectorManualContent(id: string): Promise<string | null> {
  try {
    return await invoke<string>("get_director_manual", { id });
  } catch (error) {
    console.error("[skills] loadDirectorManualContent failed:", error);
    return null;
  }
}
