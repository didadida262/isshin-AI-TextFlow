import { invoke } from "@tauri-apps/api/core";

export const ASSET_STATE_SUCCESS = 1;
export const ASSET_STATE_ERROR = 2;

export interface ProjectAssetRecord {
  id: number;
  projectId: string;
  name: string;
  assetType: string;
  prompt: string;
  model: string;
  size: string;
  imagePath: string | null;
  assetState: number;
  errorReason: string | null;
  createdAt: number;
  updatedAt: number;
  generationDurationMs: number | null;
  numInferenceSteps: number | null;
}

export interface ListProjectAssetsResult {
  items: ProjectAssetRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateProjectAssetInput {
  projectId: string;
  name: string;
  assetType: string;
  prompt: string;
  model: string;
  size: string;
  imageB64?: string;
  videoB64?: string;
  generationDurationMs?: number;
  numInferenceSteps?: number;
}

export interface ListProjectAssetsOptions {
  excludeAssetTypes?: string[];
}

export async function listProjectAssets(
  projectId: string,
  page: number,
  pageSize: number,
  options?: ListProjectAssetsOptions,
): Promise<ListProjectAssetsResult> {
  return invoke<ListProjectAssetsResult>("list_project_assets", {
    input: {
      projectId,
      page,
      pageSize,
      excludeAssetTypes: options?.excludeAssetTypes ?? [],
    },
  });
}

export async function createProjectAsset(
  input: CreateProjectAssetInput,
): Promise<ProjectAssetRecord> {
  return invoke<ProjectAssetRecord>("create_project_asset", { input });
}

export interface UpdateProjectAssetInput {
  projectId: string;
  assetId: number;
  name: string;
  assetType: string;
}

export async function updateProjectAsset(
  input: UpdateProjectAssetInput,
): Promise<ProjectAssetRecord> {
  return invoke<ProjectAssetRecord>("update_project_asset", { input });
}

export interface DeleteProjectAssetInput {
  projectId: string;
  assetId: number;
}

export async function deleteProjectAsset(
  input: DeleteProjectAssetInput,
): Promise<void> {
  return invoke<void>("delete_project_asset", { input });
}
