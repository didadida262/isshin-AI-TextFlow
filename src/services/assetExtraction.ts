import type { GenerateAssetFormValues } from "../components/GenerateAssetModal";
import type { AppConfig } from "../types";
import {
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_NUM_INFERENCE_STEPS,
} from "./config";
import { generateAssetImageB64 } from "./imageGeneration";
import { createProjectAsset } from "./assets";
import type { ProjectAssetRecord } from "./assets";
import {
  extractAssetsFromScriptsWithAgent,
  type ExtractAssetsProgress,
} from "../agents/workflowAgent/assetExtraction";
import type { ExtractedAsset } from "../utils/extractAssetsFromScript";
import type { ScriptRecord } from "./script";

export type DraftAssetStatus = "pending" | "generating" | "success" | "error";

export interface DraftAssetItem {
  id: string;
  name: string;
  assetType: ExtractedAsset["assetType"];
  prompt: string;
  status: DraftAssetStatus;
  errorReason?: string;
  savedAssetId?: number;
  savedAsset?: ProjectAssetRecord;
}

export interface BatchGenerateAssetOptions {
  projectId: string;
  artStyleId?: string;
  config: AppConfig;
  items: DraftAssetItem[];
  onItemProgress?: (itemId: string, patch: Partial<DraftAssetItem>) => void;
  signal?: AbortSignal;
}

export interface BatchGenerateAssetResult {
  items: DraftAssetItem[];
  saved: ProjectAssetRecord[];
}

function createDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.message === "AbortError")
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal.addEventListener(
      "abort",
      () => {
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function generateAssetImageB64WithAbort(
  input: Parameters<typeof generateAssetImageB64>[0],
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);
  if (!signal) {
    return generateAssetImageB64(input);
  }
  return Promise.race([generateAssetImageB64(input), waitForAbort(signal)]);
}

export function resetGeneratingDraftItems(
  items: DraftAssetItem[],
): DraftAssetItem[] {
  return items.map((item) =>
    item.status === "generating"
      ? { ...item, status: "pending", errorReason: undefined }
      : item,
  );
}

export type DraftImageJobSubmitValues = Omit<
  GenerateAssetFormValues,
  "generationDurationMs"
>;

export function buildDraftImageJobValues(
  item: DraftAssetItem,
  config: AppConfig,
): DraftImageJobSubmitValues {
  const imageModel = config.imageModel.trim();
  const defaultSize = config.imageDefaultSize.trim() || DEFAULT_IMAGE_SIZE;
  const imageCount =
    Number.isFinite(config.imageCount) && config.imageCount >= 1
      ? config.imageCount
      : DEFAULT_IMAGE_COUNT;

  return {
    name: item.name.trim(),
    assetType: item.assetType,
    prompt: item.prompt.trim(),
    model: imageModel,
    size: defaultSize,
    n: imageCount,
    numInferenceSteps: DEFAULT_NUM_INFERENCE_STEPS,
  };
}

export function extractedToDraftItems(assets: ExtractedAsset[]): DraftAssetItem[] {
  return assets.map((asset) => ({
    id: createDraftId(),
    name: asset.name,
    assetType: asset.assetType,
    prompt: asset.prompt,
    status: "pending",
  }));
}

export type { ExtractAssetsProgress };

export interface ExtractAssetsFromScriptsOptions {
  config: AppConfig;
  model: string;
  scripts: ScriptRecord[];
  /** Project visual manual id — skills are injected at extraction time. */
  artStyleId?: string;
  onProgress?: (progress: ExtractAssetsProgress) => void;
  signal?: AbortSignal;
}

/** Extract character/scene/prop drafts from scripts via LLM asset-extraction agent. */
export async function extractAssetsFromScripts(
  options: ExtractAssetsFromScriptsOptions,
): Promise<DraftAssetItem[]> {
  const extracted = await extractAssetsFromScriptsWithAgent(options);
  return extractedToDraftItems(extracted);
}

function getImageSettings(config: AppConfig) {
  const imageModel = config.imageModel.trim();
  const defaultSize = config.imageDefaultSize.trim() || DEFAULT_IMAGE_SIZE;
  const imageCount =
    Number.isFinite(config.imageCount) && config.imageCount >= 1
      ? config.imageCount
      : DEFAULT_IMAGE_COUNT;

  return {
    imageModel,
    defaultSize,
    imageCount,
    imageSettings: {
      imageApiUrl: config.imageApiUrl,
      imageApiKey: config.imageApiKey,
      imageModel,
      imageDefaultSize: defaultSize,
      imageCount,
    },
  };
}

export async function batchGenerateDraftAssets(
  options: BatchGenerateAssetOptions,
): Promise<BatchGenerateAssetResult> {
  const { projectId, config, items, onItemProgress, signal } = options;
  const { imageModel, defaultSize, imageCount, imageSettings } =
    getImageSettings(config);

  if (!imageModel) {
    throw new Error("IMAGE_CONFIG_REQUIRED");
  }

  const nextItems = [...items];
  const saved: ProjectAssetRecord[] = [];

  for (let index = 0; index < nextItems.length; index += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const item = nextItems[index];
    if (item.status === "success") continue;

    const patch = (update: Partial<DraftAssetItem>) => {
      nextItems[index] = { ...nextItems[index], ...update };
      onItemProgress?.(item.id, update);
    };

    patch({ status: "generating", errorReason: undefined });

    const startedAt = performance.now();
    try {
      const imageB64 = await generateAssetImageB64WithAbort(
        {
          prompt: item.prompt,
          assetType: item.assetType,
          size: defaultSize,
          model: imageModel,
          n: imageCount,
          numInferenceSteps: DEFAULT_NUM_INFERENCE_STEPS,
          settings: imageSettings,
        },
        signal,
      );

      throwIfAborted(signal);

      const generationDurationMs = Math.max(
        0,
        Math.round(performance.now() - startedAt),
      );

      const record = await createProjectAsset({
        projectId,
        name: item.name.trim(),
        assetType: item.assetType,
        prompt: item.prompt.trim(),
        model: imageModel,
        size: defaultSize,
        imageB64,
        generationDurationMs,
        numInferenceSteps: DEFAULT_NUM_INFERENCE_STEPS,
      });

      saved.push(record);
      patch({
        status: "success",
        savedAssetId: record.id,
        savedAsset: record,
      });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const message = error instanceof Error ? error.message : String(error);
      patch({ status: "error", errorReason: message });
    }
  }

  return { items: nextItems, saved };
}
