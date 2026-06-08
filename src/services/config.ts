import type { AppConfig } from "../types";

const STORAGE_KEY = "textflow-config";

export const DEFAULT_IMAGE_API_URL =
  "http://27.159.92.216:8091/v1/images/generations";
export const DEFAULT_IMAGE_API_KEY = "qwen-image@srd*wrtU8EVDF20bNF";
export const DEFAULT_IMAGE_MODEL = "qwen-image-2512";
export const DEFAULT_IMAGE_SIZE = "1024x1024";
export const DEFAULT_IMAGE_COUNT = 1;
export const DEFAULT_NUM_INFERENCE_STEPS = 25;

export const DEFAULT_VIDEO_API_URL =
  "http://27.159.92.210:8081/v1/videos/sync";
export const DEFAULT_VIDEO_API_KEY =
  "wan2.2-ti2v-5b@srd*OB6sgdessj8YTF8HBVGhIYTgd76sfR";
export const DEFAULT_VIDEO_MODEL = "wan2.2-t2v-5b";
export const DEFAULT_VIDEO_SIZE = "832x480";
export const DEFAULT_VIDEO_NUM_FRAMES = 80;
export const DEFAULT_VIDEO_FPS = 16;
export const DEFAULT_VIDEO_INFERENCE_STEPS = 40;
export const DEFAULT_VIDEO_GUIDANCE_SCALE = 4.0;
export const DEFAULT_VIDEO_GUIDANCE_SCALE_2 = 4.0;
export const DEFAULT_VIDEO_BOUNDARY_RATIO = 0.875;
export const DEFAULT_VIDEO_FLOW_SHIFT = 5.0;
export const DEFAULT_VIDEO_SEED = 42;

const DEFAULT_CONFIG: AppConfig = {
  baseUrl: "https://aiplatform.njsrd.com/llm/v1",
  apiKey: "",
  models: [],
  imageApiUrl: DEFAULT_IMAGE_API_URL,
  imageApiKey: DEFAULT_IMAGE_API_KEY,
  imageModel: DEFAULT_IMAGE_MODEL,
  imageDefaultSize: DEFAULT_IMAGE_SIZE,
  imageCount: DEFAULT_IMAGE_COUNT,
  videoApiUrl: DEFAULT_VIDEO_API_URL,
  videoApiKey: DEFAULT_VIDEO_API_KEY,
  videoModel: DEFAULT_VIDEO_MODEL,
};

function mergeConfig(partial: Partial<AppConfig>): AppConfig {
  const merged: AppConfig = { ...DEFAULT_CONFIG, ...partial };
  if (!merged.baseUrl.trim()) {
    merged.baseUrl = DEFAULT_CONFIG.baseUrl;
  }
  if (!merged.imageApiUrl.trim()) {
    merged.imageApiUrl = DEFAULT_CONFIG.imageApiUrl;
  }
  if (!merged.imageModel.trim()) {
    merged.imageModel = DEFAULT_CONFIG.imageModel;
  }
  if (!merged.imageDefaultSize.trim()) {
    merged.imageDefaultSize = DEFAULT_CONFIG.imageDefaultSize;
  }
  if (!Number.isFinite(merged.imageCount) || merged.imageCount < 1) {
    merged.imageCount = DEFAULT_IMAGE_COUNT;
  }
  merged.videoApiUrl = DEFAULT_VIDEO_API_URL;
  merged.videoApiKey = DEFAULT_VIDEO_API_KEY;
  merged.videoModel = DEFAULT_VIDEO_MODEL;
  return merged;
}

function readLocalCache(): AppConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return mergeConfig(JSON.parse(raw) as Partial<AppConfig>);
  } catch {
    return null;
  }
}

function writeLocalCache(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function loadConfig(): Promise<AppConfig> {
  const cached = readLocalCache();
  return cached ?? { ...DEFAULT_CONFIG };
}

export function getDefaultConfig(): AppConfig {
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  writeLocalCache(mergeConfig(config));
}

export function isConfigValid(config: AppConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.apiKey.trim());
}

export function isImageConfigValid(config: AppConfig): boolean {
  return isImageSettingsValid(config);
}

export function isImageSettingsValid(
  settings: ImageGenerationSettings,
): boolean {
  return Boolean(
    settings.imageApiUrl.trim() &&
      settings.imageApiKey.trim() &&
      settings.imageModel.trim(),
  );
}

export type ImageGenerationSettings = Pick<
  AppConfig,
  "imageApiUrl" | "imageApiKey" | "imageModel" | "imageDefaultSize" | "imageCount"
>;

export function isVideoSettingsValid(
  settings: VideoGenerationSettings,
): boolean {
  return Boolean(
    settings.videoApiUrl.trim() && settings.videoApiKey.trim(),
  );
}

export type VideoGenerationSettings = Pick<
  AppConfig,
  "videoApiUrl" | "videoApiKey" | "videoModel"
>;

export function getFixedVideoSettings(): VideoGenerationSettings {
  return {
    videoApiUrl: DEFAULT_VIDEO_API_URL,
    videoApiKey: DEFAULT_VIDEO_API_KEY,
    videoModel: DEFAULT_VIDEO_MODEL,
  };
}
