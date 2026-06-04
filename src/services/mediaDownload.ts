import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

export type MediaDownloadKind = "image" | "video";

function stripBase64Payload(base64: string): string {
  const trimmed = base64.trim();
  const commaIndex = trimmed.indexOf("base64,");
  if (commaIndex >= 0) {
    return trimmed.slice(commaIndex + "base64,".length);
  }
  return trimmed.replace(/^data:[^;]+;base64,/, "");
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const payload = stripBase64Payload(base64);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const MEDIA_META: Record<
  MediaDownloadKind,
  { mimeType: string; extension: string; namePrefix: string; dialogFilter: string }
> = {
  image: {
    mimeType: "image/png",
    extension: "png",
    namePrefix: "image-test",
    dialogFilter: "PNG",
  },
  video: {
    mimeType: "video/mp4",
    extension: "mp4",
    namePrefix: "video-test",
    dialogFilter: "MP4",
  },
};

export async function downloadBase64Media(
  kind: MediaDownloadKind,
  base64: string,
  options?: { dialogTitle?: string },
): Promise<boolean> {
  const cleaned = stripBase64Payload(base64);
  if (!cleaned) return false;

  const meta = MEDIA_META[kind];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultName = `${meta.namePrefix}-${timestamp}.${meta.extension}`;

  if (!isTauri()) {
    triggerBrowserDownload(base64ToBlob(base64, meta.mimeType), defaultName);
    return true;
  }

  const path = await save({
    title: options?.dialogTitle,
    defaultPath: defaultName,
    filters: [{ name: meta.dialogFilter, extensions: [meta.extension] }],
  });

  if (!path) return false;

  await invoke("write_base64_file", { path, base64: cleaned });
  return true;
}
