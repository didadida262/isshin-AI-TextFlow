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

export async function generateImageB64(
  input: GenerateImageInput,
): Promise<string> {
  const settings = await resolveImageGenerationSettings(input.settings);
  if (!isImageSettingsValid(settings)) {
    throw new Error("IMAGE_CONFIG_REQUIRED");
  }

  const result = await invoke<{ b64Json: string }>("generate_image", {
    input: {
      prompt: input.prompt.trim(),
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
