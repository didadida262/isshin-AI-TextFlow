import { invoke } from "@tauri-apps/api/core";
import {
  getPromptRefineSettingsFromConfig,
  isPromptRefineSettingsValid,
  loadConfig,
  type PromptRefineSettings,
} from "./config";

const EXPAND_PROMPT_PREFIX = "扩充提示词：";

export async function resolvePromptRefineSettings(
  settings?: PromptRefineSettings,
): Promise<PromptRefineSettings> {
  if (settings) return settings;
  const config = await loadConfig();
  return getPromptRefineSettingsFromConfig(config);
}

export async function expandPrompt(
  prompt: string,
  settings?: PromptRefineSettings,
): Promise<string> {
  const resolvedSettings = await resolvePromptRefineSettings(settings);
  if (!isPromptRefineSettingsValid(resolvedSettings)) {
    throw new Error("PROMPT_REFINE_CONFIG_REQUIRED");
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("PROMPT_REQUIRED");
  }

  const result = await invoke<{ content: string }>("llm_chat_completion", {
    payload: {
      url: resolvedSettings.promptRefineApiUrl.trim(),
      apiKey: resolvedSettings.promptRefineApiKey.trim(),
      label: "expand-prompt",
      body: {
        model: resolvedSettings.promptRefineModel.trim(),
        messages: [
          {
            role: "user",
            content: `${EXPAND_PROMPT_PREFIX}${trimmedPrompt}`,
          },
        ],
        stream: false,
      },
    },
  });

  const expanded = result.content.trim();
  if (!expanded) {
    throw new Error("PROMPT_REFINE_EMPTY_RESPONSE");
  }

  return expanded;
}
