import type { AppConfig } from "../types";

const STORAGE_KEY = "textflow-config";

export const DEFAULT_IMAGE_API_URL =
  "http://27.159.92.216:8091/v1/images/generations";
export const DEFAULT_IMAGE_API_KEY = "qwen-image@srd*wrtU8EVDF20bNF";
export const DEFAULT_IMAGE_MODEL = "qwen-image-2512";
export const DEFAULT_IMAGE_SIZE = "1024x1024";
export const DEFAULT_IMAGE_COUNT = 1;

const DEFAULT_CONFIG: AppConfig = {
  baseUrl: "https://aiplatform.njsrd.com/llm/v1",
  apiKey: "",
  models: [],
  imageApiUrl: DEFAULT_IMAGE_API_URL,
  imageApiKey: DEFAULT_IMAGE_API_KEY,
  imageModel: DEFAULT_IMAGE_MODEL,
  imageDefaultSize: DEFAULT_IMAGE_SIZE,
  imageCount: DEFAULT_IMAGE_COUNT,
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
