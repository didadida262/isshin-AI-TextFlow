import { invoke } from "@tauri-apps/api/core";
import type { CreationProject } from "../types";
import type { NewProjectDraft } from "../components/NewProjectModal";

interface RawProject {
  id: string;
  name: string;
  projectType: string;
  novelType: string;
  imageModel: string;
  imageQuality: string;
  videoModel: string;
  videoMode: string;
  aspectRatio: string;
  intro: string;
  artStyle: string;
  directorManual: string;
  createdAt: number;
  updatedAt: number;
}

function mapProject(raw: RawProject): CreationProject {
  return {
    id: raw.id,
    name: raw.name,
    projectType: raw.projectType,
    novelType: raw.novelType,
    imageModel: raw.imageModel,
    imageQuality: raw.imageQuality,
    videoModel: raw.videoModel,
    videoMode: raw.videoMode,
    aspectRatio: raw.aspectRatio,
    intro: raw.intro,
    artStyle: raw.artStyle,
    directorManual: raw.directorManual,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function draftToProjectInput(draft: NewProjectDraft): CreationProject {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: draft.name.trim(),
    projectType: draft.projectType,
    novelType: draft.novelType.trim(),
    imageModel: draft.imageModel,
    imageQuality: draft.imageQuality,
    videoModel: draft.videoModel,
    videoMode: draft.videoMode,
    aspectRatio: draft.aspectRatio,
    intro: draft.intro.trim(),
    artStyle: draft.artStyle,
    directorManual: draft.directorManual,
    createdAt: now,
    updatedAt: now,
  };
}

export function projectToDraft(project: CreationProject): NewProjectDraft {
  return {
    projectType: project.projectType,
    name: project.name,
    novelType: project.novelType,
    imageModel: project.imageModel,
    imageQuality: project.imageQuality,
    videoModel: project.videoModel,
    videoMode: project.videoMode,
    aspectRatio: project.aspectRatio,
    intro: project.intro,
    artStyle: project.artStyle,
    directorManual: project.directorManual,
  };
}

export async function loadProjects(): Promise<CreationProject[]> {
  try {
    const items = await invoke<RawProject[]>("list_projects");
    return items.map(mapProject);
  } catch (error) {
    console.error("[projects] loadProjects failed:", error);
    return [];
  }
}

export async function createProject(
  project: CreationProject,
): Promise<CreationProject | null> {
  try {
    const created = await invoke<RawProject>("create_project", {
      input: {
        id: project.id,
        name: project.name,
        projectType: project.projectType,
        novelType: project.novelType,
        imageModel: project.imageModel,
        imageQuality: project.imageQuality,
        videoModel: project.videoModel,
        videoMode: project.videoMode,
        aspectRatio: project.aspectRatio,
        intro: project.intro,
        artStyle: project.artStyle,
        directorManual: project.directorManual,
        createdAt: project.createdAt,
      },
    });
    return mapProject(created);
  } catch (error) {
    console.error("[projects] createProject failed:", error);
    return null;
  }
}

export async function updateProject(
  id: string,
  draft: NewProjectDraft,
): Promise<CreationProject | null> {
  try {
    const updated = await invoke<RawProject>("update_project", {
      input: {
        id,
        name: draft.name.trim(),
        projectType: draft.projectType,
        novelType: draft.novelType.trim(),
        imageModel: draft.imageModel,
        imageQuality: draft.imageQuality,
        videoModel: draft.videoModel,
        videoMode: draft.videoMode,
        aspectRatio: draft.aspectRatio,
        intro: draft.intro.trim(),
        artStyle: draft.artStyle,
        directorManual: draft.directorManual,
      },
    });
    return mapProject(updated);
  } catch (error) {
    console.error("[projects] updateProject failed:", error);
    return null;
  }
}
