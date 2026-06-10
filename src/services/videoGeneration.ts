import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "../types";
import {
  DEFAULT_VIDEO_API_URL,
  DEFAULT_VIDEO_BOUNDARY_RATIO,
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_FLOW_SHIFT,
  DEFAULT_VIDEO_GUIDANCE_SCALE,
  DEFAULT_VIDEO_GUIDANCE_SCALE_2,
  DEFAULT_VIDEO_INFERENCE_STEPS,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_NUM_FRAMES,
  DEFAULT_VIDEO_SEED,
  DEFAULT_VIDEO_SIZE,
  getDefaultKuaiziVideoParams,
  getVideoSettingsFromConfig,
  isKuaiziVideoApi,
  isVideoSettingsValid,
  loadConfig,
  normalizeKuaiziVideoCreateUrl,
  type KuaiziVideoParams,
  type VideoGenerationSettings,
} from "./config";

export interface VideoJobSubmitValues {
  name: string;
  prompt: string;
  model: string;
  size: string;
  numFrames: number;
  fps: number;
  numInferenceSteps: number;
  guidanceScale: number;
  guidanceScale2: number;
  boundaryRatio: number;
  flowShift: number;
  seed: number;
}

/** Default generation params for background video jobs from the workflow table. */
export function buildDefaultVideoJobValues(
  name: string,
  prompt: string,
  config: AppConfig,
): VideoJobSubmitValues {
  return {
    name: name.trim(),
    prompt: prompt.trim(),
    model: config.videoModel.trim() || DEFAULT_VIDEO_MODEL,
    size: DEFAULT_VIDEO_SIZE,
    numFrames: DEFAULT_VIDEO_NUM_FRAMES,
    fps: DEFAULT_VIDEO_FPS,
    numInferenceSteps: DEFAULT_VIDEO_INFERENCE_STEPS,
    guidanceScale: DEFAULT_VIDEO_GUIDANCE_SCALE,
    guidanceScale2: DEFAULT_VIDEO_GUIDANCE_SCALE_2,
    boundaryRatio: DEFAULT_VIDEO_BOUNDARY_RATIO,
    flowShift: DEFAULT_VIDEO_FLOW_SHIFT,
    seed: DEFAULT_VIDEO_SEED,
  };
}

export interface GenerateVideoInput {
  prompt: string;
  size?: string;
  numFrames?: number;
  fps?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  guidanceScale2?: number;
  boundaryRatio?: number;
  flowShift?: number;
  seed?: number;
  kuaizi?: KuaiziVideoParams;
  settings?: VideoGenerationSettings;
}

export async function resolveVideoGenerationSettings(
  settings?: VideoGenerationSettings,
): Promise<VideoGenerationSettings> {
  if (settings) return settings;
  const config = await loadConfig();
  return getVideoSettingsFromConfig(config);
}

export const VIDEO_TEST_PROMPT =
  "一只可爱的柯基犬在开满向日葵的田野里快乐地奔跑";

export async function testVideoConnection(
  settings?: VideoGenerationSettings,
  prompt: string = VIDEO_TEST_PROMPT,
  kuaizi?: KuaiziVideoParams,
): Promise<string> {
  const resolvedSettings = await resolveVideoGenerationSettings(settings);
  if (!isVideoSettingsValid(resolvedSettings)) {
    throw new Error("VIDEO_CONFIG_REQUIRED");
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("VIDEO_TEST_PROMPT_REQUIRED");
  }

  return generateVideoB64({
    prompt: trimmedPrompt,
    settings: resolvedSettings,
    kuaizi: isKuaiziVideoApi(resolvedSettings.videoApiUrl)
      ? (kuaizi ?? getDefaultKuaiziVideoParams())
      : undefined,
  });
}

export async function generateVideoB64(
  input: GenerateVideoInput,
): Promise<string> {
  const settings = await resolveVideoGenerationSettings(input.settings);
  if (!isVideoSettingsValid(settings)) {
    throw new Error("VIDEO_CONFIG_REQUIRED");
  }

  const useKuaizi = isKuaiziVideoApi(settings.videoApiUrl);
  const kuaiziParams = useKuaizi
    ? (input.kuaizi ?? getDefaultKuaiziVideoParams())
    : undefined;
  const apiUrl = useKuaizi
    ? normalizeKuaiziVideoCreateUrl(settings.videoApiUrl)
    : settings.videoApiUrl.trim() || DEFAULT_VIDEO_API_URL;

  const result = await invoke<{ videoB64: string }>("generate_video", {
    input: useKuaizi
      ? {
          prompt: input.prompt.trim(),
          apiUrl,
          apiKey: settings.videoApiKey.trim(),
          mode: kuaiziParams?.mode,
          resolution: kuaiziParams?.resolution,
          ratio: kuaiziParams?.ratio,
          duration: kuaiziParams?.duration,
          generationType: kuaiziParams?.generationType,
        }
      : {
          prompt: input.prompt.trim(),
          apiUrl,
          apiKey: settings.videoApiKey.trim(),
          size: input.size ?? DEFAULT_VIDEO_SIZE,
          numFrames: input.numFrames ?? DEFAULT_VIDEO_NUM_FRAMES,
          fps: input.fps ?? DEFAULT_VIDEO_FPS,
          numInferenceSteps:
            input.numInferenceSteps ?? DEFAULT_VIDEO_INFERENCE_STEPS,
          guidanceScale: input.guidanceScale ?? DEFAULT_VIDEO_GUIDANCE_SCALE,
          guidanceScale2:
            input.guidanceScale2 ?? DEFAULT_VIDEO_GUIDANCE_SCALE_2,
          boundaryRatio: input.boundaryRatio ?? DEFAULT_VIDEO_BOUNDARY_RATIO,
          flowShift: input.flowShift ?? DEFAULT_VIDEO_FLOW_SHIFT,
          seed: input.seed ?? DEFAULT_VIDEO_SEED,
        },
  });

  return result.videoB64;
}
