import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_IMAGE_SIZE,
  isImageSettingsValid,
  loadConfig,
  type ImageGenerationSettings,
} from "./config";

export interface GenerateImageInput {
  prompt: string;
  size?: string;
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
      model: settings.imageModel,
      n: settings.imageCount,
    },
  });

  return result.b64Json;
}

export const IMAGE_TEST_PROMPT = "一只可爱的卡通熊猫在吃竹子，3D风格";

export async function testImageConnection(
  settings: ImageGenerationSettings,
): Promise<string> {
  if (!isImageSettingsValid(settings)) {
    throw new Error("IMAGE_CONFIG_REQUIRED");
  }

  const result = await invoke<{ b64Json: string }>("generate_image", {
    input: {
      prompt: IMAGE_TEST_PROMPT,
      size: settings.imageDefaultSize.trim() || DEFAULT_IMAGE_SIZE,
      apiUrl: settings.imageApiUrl.trim(),
      apiKey: settings.imageApiKey.trim(),
      model: settings.imageModel.trim(),
      n: 1,
    },
  });

  return result.b64Json;
}
