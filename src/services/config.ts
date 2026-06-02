import type { AppConfig } from "../types";

const STORAGE_KEY = "textflow-config";

const DEFAULT_CONFIG: AppConfig = {
  baseUrl: "https://aiplatform.njsrd.com/llm/v1",
  apiKey: "",
  models: [],
};

function mergeConfig(partial: Partial<AppConfig>): AppConfig {
  const merged: AppConfig = { ...DEFAULT_CONFIG, ...partial };
  if (!merged.baseUrl.trim()) {
    merged.baseUrl = DEFAULT_CONFIG.baseUrl;
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

export async function saveConfig(config: AppConfig): Promise<void> {
  writeLocalCache(mergeConfig(config));
}

export function isConfigValid(config: AppConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.apiKey.trim());
}
