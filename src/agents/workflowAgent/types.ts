import type { AppConfig, CreationProject } from "../../types";
import type { NovelChapterRecord } from "../../services/novel";
import type { ScriptRecord, ScriptWorkData } from "../../services/script";

export interface ScriptAgentContext {
  project: CreationProject;
  config: AppConfig;
  model: string;
  chapters: NovelChapterRecord[];
  workData: ScriptWorkData;
  scripts: ScriptRecord[];
  directorSkillContent?: string;
  signal?: AbortSignal;
}

export type ScriptPipelineStage = "skeleton" | "adaptation" | "scripts";

export interface ScriptGenerationProgress {
  stage: ScriptPipelineStage;
  completed?: number;
  total?: number;
}
