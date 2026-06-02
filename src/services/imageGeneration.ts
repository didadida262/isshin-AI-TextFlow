import { invoke } from "@tauri-apps/api/core";

export const IMAGE_GENERATION_API_URL =
  "http://27.159.92.216:8091/v1/images/generations";
export const IMAGE_GENERATION_API_KEY = "qwen-image@srd*wrtU8EVDF20bNF";
export const DEFAULT_IMAGE_MODEL = "qwen-image-2512";
export const DEFAULT_IMAGE_SIZE = "1024x1024";

export interface GenerateImageInput {
  prompt: string;
  size?: string;
}

export async function generateImageB64(
  input: GenerateImageInput,
): Promise<string> {
  const result = await invoke<{ b64Json: string }>("generate_image", {
    input: {
      prompt: input.prompt.trim(),
      size: input.size ?? DEFAULT_IMAGE_SIZE,
      apiUrl: IMAGE_GENERATION_API_URL,
      apiKey: IMAGE_GENERATION_API_KEY,
    },
  });

  return result.b64Json;
}
