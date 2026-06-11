import type {
  GenerationJob,
  GenerationJobStatus,
} from "../contexts/GenerationJobsContext";
import { ASSET_STATE_ERROR, type ProjectAssetRecord } from "../services/assets";

export type VideoStatusKind = "success" | "error" | "pending" | "generating";

export interface LatestVideoJobInfo {
  status: GenerationJobStatus;
  errorMessage?: string;
}

export function getVideoStatusKind(
  video: ProjectAssetRecord | null | undefined,
  jobStatus?: GenerationJobStatus,
): VideoStatusKind {
  if (jobStatus === "running") return "generating";
  if (jobStatus === "error") return "error";
  if (!video) return "pending";
  if (video.assetState === ASSET_STATE_ERROR) return "error";
  if (video.imagePath) return "success";
  return "pending";
}

export function buildLatestVideoJobMap(
  jobs: GenerationJob[],
  projectId: string,
): Map<string, LatestVideoJobInfo> {
  const map = new Map<string, LatestVideoJobInfo>();
  const videoJobs = jobs
    .filter((job) => job.kind === "video" && job.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const job of videoJobs) {
    const key = job.scriptName ?? job.itemName;
    if (!map.has(key)) {
      map.set(key, {
        status: job.status,
        errorMessage: job.errorMessage,
      });
    }
  }

  return map;
}

export function resolveVideoErrorMessage(
  video: ProjectAssetRecord | null | undefined,
  jobInfo?: LatestVideoJobInfo,
): string | null {
  const assetError = video?.errorReason?.trim();
  if (assetError) return assetError;

  const jobError = jobInfo?.errorMessage?.trim();
  if (jobInfo?.status === "error" && jobError) return jobError;

  return null;
}
