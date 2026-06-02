import { invoke } from "@tauri-apps/api/core";

export interface ScriptWorkData {
  storySkeleton: string;
  adaptationStrategy: string;
}

export interface ScriptRecord {
  id: number;
  projectId: string;
  episodeIndex: number;
  name: string;
  content: string;
  scriptState: number;
  errorReason: string | null;
  updatedAt: number;
}

export const SCRIPT_STATE_PENDING = 0;
export const SCRIPT_STATE_SUCCESS = 1;
export const SCRIPT_STATE_ERROR = 2;

export function isScriptGenerationComplete(
  chaptersCount: number,
  scripts: ScriptRecord[],
): boolean {
  if (chaptersCount <= 0) return false;
  const successCount = scripts.filter(
    (script) => script.scriptState === SCRIPT_STATE_SUCCESS,
  ).length;
  return successCount >= chaptersCount;
}

export async function getScriptWorkData(
  projectId: string,
): Promise<ScriptWorkData> {
  return invoke<ScriptWorkData>("get_script_work_data", { projectId });
}

export async function setScriptWorkData(
  projectId: string,
  patch: Partial<ScriptWorkData>,
): Promise<ScriptWorkData> {
  return invoke<ScriptWorkData>("set_script_work_data", {
    input: {
      projectId,
      storySkeleton: patch.storySkeleton,
      adaptationStrategy: patch.adaptationStrategy,
    },
  });
}

export async function listScripts(projectId: string): Promise<ScriptRecord[]> {
  return invoke<ScriptRecord[]>("list_scripts", { projectId });
}

export interface UpsertScriptInput {
  projectId: string;
  episodeIndex: number;
  name: string;
  content: string;
  scriptState: number;
  errorReason: string | null;
}

export async function upsertScript(
  input: UpsertScriptInput,
): Promise<ScriptRecord> {
  return invoke<ScriptRecord>("upsert_script", { input });
}
