import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_NUM_INFERENCE_STEPS,
  isImageSettingsValid,
  loadConfig,
  type ImageGenerationSettings,
} from "./config";

export interface GenerateImageInput {
  prompt: string;
  size?: string;
  model?: string;
  n?: number;
  numInferenceSteps?: number;
  settings?: ImageGenerationSettings;
}

export interface GenerateAssetImageInput extends GenerateImageInput {
  /** Project visual manual id (`CreationProject.artStyle`). */
  artStyleId?: string;
  assetType?: string;
}

export async function resolveImageGenerationSettings(
  settings?: ImageGenerationSettings,
): Promise<ImageGenerationSettings> {
  if (settings) return settings;
  const config = await loadConfig();
  return {
    imageApiUrl: config.imageApiUrl,
    imageApiKey: config.imageApiKey,
    imageModel: config.imageModel,
    imageDefaultSize: config.imageDefaultSize,
    imageCount: config.imageCount,
  };
}

/** Generate image for a project asset using the stored prompt as-is. */
export async function generateAssetImageB64(
  input: GenerateAssetImageInput,
): Promise<string> {
  return generateImageB64(input);
}

export async function generateImageB64(
  input: GenerateImageInput,
): Promise<string> {
  const settings = await resolveImageGenerationSettings(input.settings);
  if (!isImageSettingsValid(settings)) {
    throw new Error("IMAGE_CONFIG_REQUIRED");
  }

  const result = await invoke<{ b64Json: string }>("generate_image", {
    input: {
      prompt: truncateImagePrompt(input.prompt),
      size: input.size ?? settings.imageDefaultSize ?? DEFAULT_IMAGE_SIZE,
      apiUrl: settings.imageApiUrl,
      apiKey: settings.imageApiKey,
      model: input.model?.trim() || settings.imageModel,
      n: input.n ?? settings.imageCount ?? DEFAULT_IMAGE_COUNT,
      numInferenceSteps:
        input.numInferenceSteps ?? DEFAULT_NUM_INFERENCE_STEPS,
    },
  });

  return result.b64Json;
}

export const IMAGE_TEST_PROMPT = "一只可爱的卡通熊猫在吃竹子，3D风格";

/** Max prompt length for image APIs; matches asset-extraction output cap. */
export const MAX_IMAGE_PROMPT_CHARS = 5000;

/** Max prompt length produced by asset-extraction agent per target. */
export const MAX_ASSET_EXTRACTION_PROMPT_CHARS = 5000;

export function truncateImagePrompt(
  prompt: string,
  maxChars = MAX_IMAGE_PROMPT_CHARS,
): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const slice = trimmed.slice(0, maxChars);
  const breakAt = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("，"),
    slice.lastIndexOf("；"),
    slice.lastIndexOf(" "),
  );
  if (breakAt > maxChars * 0.6) {
    return slice.slice(0, breakAt + 1).trim();
  }
  return slice.trim();
}

export async function testImageConnection(
  settings: ImageGenerationSettings,
  prompt: string = IMAGE_TEST_PROMPT,
): Promise<string> {
  if (!isImageSettingsValid(settings)) {
    throw new Error("IMAGE_CONFIG_REQUIRED");
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("IMAGE_TEST_PROMPT_REQUIRED");
  }

  const result = await invoke<{ b64Json: string }>("generate_image", {
    input: {
      prompt: trimmedPrompt,
      size: DEFAULT_IMAGE_SIZE,
      apiUrl: settings.imageApiUrl.trim(),
      apiKey: settings.imageApiKey.trim(),
      model: settings.imageModel.trim(),
      n: DEFAULT_IMAGE_COUNT,
    },
  });

  return result.b64Json;
}
