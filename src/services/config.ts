import { invoke } from "@tauri-apps/api/core";
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

/** 合并 Tauri 与 localStorage，优先保留有 API Key 的一侧 */
function reconcile(
  primary: AppConfig,
  secondary: AppConfig | null,
): AppConfig {
  const merged = mergeConfig(primary);
  if (!secondary) return merged;

  if (!merged.apiKey.trim() && secondary.apiKey.trim()) {
    merged.apiKey = secondary.apiKey;
  }
  if (merged.models.length === 0 && secondary.models.length > 0) {
    merged.models = secondary.models;
  }
  if (!merged.baseUrl.trim() && secondary.baseUrl.trim()) {
    merged.baseUrl = secondary.baseUrl;
  }
  return merged;
}

export async function loadConfig(): Promise<AppConfig> {
  const cached = readLocalCache();

  try {
    const cfg = await invoke<AppConfig>("load_config");
    const merged = reconcile(mergeConfig(cfg), cached);
    writeLocalCache(merged);
    return merged;
  } catch {
    if (cached) return cached;
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const merged = mergeConfig(config);
  writeLocalCache(merged);
  try {
    await invoke("save_config", { config: merged });
  } catch {
    // 浏览器 dev 模式或无 Tauri 时，localStorage 仍可用
  }
}

export function isConfigValid(config: AppConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.apiKey.trim());
}
