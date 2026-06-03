import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_VIDEO_API_URL,
  DEFAULT_VIDEO_BOUNDARY_RATIO,
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_FLOW_SHIFT,
  DEFAULT_VIDEO_GUIDANCE_SCALE,
  DEFAULT_VIDEO_GUIDANCE_SCALE_2,
  DEFAULT_VIDEO_INFERENCE_STEPS,
  DEFAULT_VIDEO_NUM_FRAMES,
  DEFAULT_VIDEO_SEED,
  DEFAULT_VIDEO_SIZE,
  getFixedVideoSettings,
  isVideoSettingsValid,
  type VideoGenerationSettings,
} from "./config";

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
  settings?: VideoGenerationSettings;
}

export async function resolveVideoGenerationSettings(
  _settings?: VideoGenerationSettings,
): Promise<VideoGenerationSettings> {
  return getFixedVideoSettings();
}

export const VIDEO_TEST_PROMPT =
  "一只可爱的柯基犬在开满向日葵的田野里快乐地奔跑";

export async function testVideoConnection(
  settings: VideoGenerationSettings = getFixedVideoSettings(),
  prompt: string = VIDEO_TEST_PROMPT,
): Promise<string> {
  if (!isVideoSettingsValid(settings)) {
    throw new Error("VIDEO_CONFIG_REQUIRED");
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("VIDEO_TEST_PROMPT_REQUIRED");
  }

  return generateVideoB64({
    prompt: trimmedPrompt,
    settings,
  });
}

export async function generateVideoB64(
  input: GenerateVideoInput,
): Promise<string> {
  const settings = await resolveVideoGenerationSettings(input.settings);
  if (!isVideoSettingsValid(settings)) {
    throw new Error("VIDEO_CONFIG_REQUIRED");
  }

  const result = await invoke<{ videoB64: string }>("generate_video", {
    input: {
      prompt: input.prompt.trim(),
      apiUrl: settings.videoApiUrl.trim() || DEFAULT_VIDEO_API_URL,
      apiKey: settings.videoApiKey.trim(),
      size: input.size ?? DEFAULT_VIDEO_SIZE,
      numFrames: input.numFrames ?? DEFAULT_VIDEO_NUM_FRAMES,
      fps: input.fps ?? DEFAULT_VIDEO_FPS,
      numInferenceSteps:
        input.numInferenceSteps ?? DEFAULT_VIDEO_INFERENCE_STEPS,
      guidanceScale: input.guidanceScale ?? DEFAULT_VIDEO_GUIDANCE_SCALE,
      guidanceScale2: input.guidanceScale2 ?? DEFAULT_VIDEO_GUIDANCE_SCALE_2,
      boundaryRatio: input.boundaryRatio ?? DEFAULT_VIDEO_BOUNDARY_RATIO,
      flowShift: input.flowShift ?? DEFAULT_VIDEO_FLOW_SHIFT,
      seed: input.seed ?? DEFAULT_VIDEO_SEED,
    },
  });

  return result.videoB64;
}
