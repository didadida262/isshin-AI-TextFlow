import { invoke } from "@tauri-apps/api/core";
import type {
  ProjectWorkflowNode,
  ProjectWorkflowStepId,
} from "../types";
import type { NovelChapterRecord, NovelSourceRecord } from "./novel";
import type { ScriptRecord } from "./script";
import type { ListProjectAssetsResult } from "./assets";

export interface ExtractEventsNodeDetail {
  kind: "extractEvents";
  nodeId: ProjectWorkflowStepId;
  source: NovelSourceRecord | null;
  chapters: NovelChapterRecord[];
}

export interface PlaceholderNodeDetail {
  kind: "placeholder";
  nodeId: ProjectWorkflowStepId;
}

export interface AiScriptNodeDetail {
  kind: "aiScript";
  nodeId: ProjectWorkflowStepId;
  source: NovelSourceRecord | null;
  chapters: NovelChapterRecord[];
  workData: {
    storySkeleton: string;
    adaptationStrategy: string;
  };
  scripts: ScriptRecord[];
}

export interface GenerateAssetsNodeDetail {
  kind: "generateAssets";
  nodeId: ProjectWorkflowStepId;
  assets: ListProjectAssetsResult;
}

export type WorkflowNodeDetail =
  | ExtractEventsNodeDetail
  | AiScriptNodeDetail
  | GenerateAssetsNodeDetail
  | PlaceholderNodeDetail;

const inflightRequests = new Map<string, Promise<unknown>>();

function dedupeRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  const existing = inflightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = request().finally(() => {
    inflightRequests.delete(key);
  });
  inflightRequests.set(key, promise);
  return promise;
}

export async function listProjectWorkflowNodes(
  projectId: string,
): Promise<ProjectWorkflowNode[]> {
  return dedupeRequest(`list-nodes:${projectId}`, () =>
    invoke<ProjectWorkflowNode[]>("list_project_workflow_nodes", {
      projectId,
    }),
  );
}

export async function getProjectWorkflowNodeDetail(
  projectId: string,
  nodeId: ProjectWorkflowStepId,
): Promise<WorkflowNodeDetail> {
  return dedupeRequest(`node-detail:${projectId}:${nodeId}`, () =>
    invoke<WorkflowNodeDetail>("get_project_workflow_node_detail", {
      input: { projectId, nodeId },
    }),
  );
}
