import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_IMAGE_TO_VIDEO_API_URL,
  DEFAULT_IMAGE_TO_VIDEO_FLOW_SHIFT,
  DEFAULT_IMAGE_TO_VIDEO_GUIDANCE_SCALE,
  DEFAULT_IMAGE_TO_VIDEO_GUIDANCE_SCALE_2,
  DEFAULT_IMAGE_TO_VIDEO_NEGATIVE_PROMPT,
  DEFAULT_VIDEO_BOUNDARY_RATIO,
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_INFERENCE_STEPS,
  DEFAULT_VIDEO_NUM_FRAMES,
  DEFAULT_VIDEO_SEED,
  DEFAULT_VIDEO_SIZE,
  getFixedImageToVideoSettings,
  isImageToVideoSettingsValid,
  type ImageToVideoGenerationSettings,
} from "./config";

export interface GenerateImageToVideoInput {
  prompt: string;
  inputReferenceB64: string;
  inputReferenceFilename: string;
  negativePrompt?: string;
  size?: string;
  numFrames?: number;
  fps?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  guidanceScale2?: number;
  boundaryRatio?: number;
  flowShift?: number;
  seed?: number;
  settings?: ImageToVideoGenerationSettings;
}

export const IMAGE_TO_VIDEO_TEST_PROMPT =
  "一只可爱的柯基犬在开满向日葵的田野里快乐地奔跑";

export async function resolveImageToVideoGenerationSettings(
  _settings?: ImageToVideoGenerationSettings,
): Promise<ImageToVideoGenerationSettings> {
  return getFixedImageToVideoSettings();
}

export async function generateImageToVideoB64(
  input: GenerateImageToVideoInput,
): Promise<string> {
  const settings = await resolveImageToVideoGenerationSettings(input.settings);
  if (!isImageToVideoSettingsValid(settings)) {
    throw new Error("IMAGE_TO_VIDEO_CONFIG_REQUIRED");
  }

  const referenceB64 = input.inputReferenceB64
    .trim()
    .replace(/^data:image\/[a-z+]+;base64,/, "");
  if (!referenceB64) {
    throw new Error("IMAGE_TO_VIDEO_REFERENCE_REQUIRED");
  }

  const result = await invoke<{ videoB64: string }>("generate_image_to_video", {
    input: {
      prompt: input.prompt.trim(),
      inputReferenceB64: referenceB64,
      inputReferenceFilename: input.inputReferenceFilename.trim() || "reference.jpg",
      negativePrompt:
        input.negativePrompt?.trim() || DEFAULT_IMAGE_TO_VIDEO_NEGATIVE_PROMPT,
      apiUrl:
        settings.imageToVideoApiUrl.trim() || DEFAULT_IMAGE_TO_VIDEO_API_URL,
      apiKey: settings.imageToVideoApiKey.trim(),
      size: input.size ?? DEFAULT_VIDEO_SIZE,
      numFrames: input.numFrames ?? DEFAULT_VIDEO_NUM_FRAMES,
      fps: input.fps ?? DEFAULT_VIDEO_FPS,
      numInferenceSteps:
        input.numInferenceSteps ?? DEFAULT_VIDEO_INFERENCE_STEPS,
      guidanceScale:
        input.guidanceScale ?? DEFAULT_IMAGE_TO_VIDEO_GUIDANCE_SCALE,
      guidanceScale2:
        input.guidanceScale2 ?? DEFAULT_IMAGE_TO_VIDEO_GUIDANCE_SCALE_2,
      boundaryRatio: input.boundaryRatio ?? DEFAULT_VIDEO_BOUNDARY_RATIO,
      flowShift: input.flowShift ?? DEFAULT_IMAGE_TO_VIDEO_FLOW_SHIFT,
      seed: input.seed ?? DEFAULT_VIDEO_SEED,
    },
  });

  return result.videoB64;
}
