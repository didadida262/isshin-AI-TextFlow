import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { TimelineClipRecord } from "./editExportTimeline";

export interface TimelineExportClipInput {
  filePath: string;
  sourceOffsetMs: number;
  durationMs: number;
}

export async function exportTimelineVideo(
  clips: TimelineClipRecord[],
  dialogTitle: string,
  defaultName: string,
): Promise<string | null> {
  const videoClips = clips
    .filter((clip) => clip.track === "video")
    .sort((a, b) => a.startMs - b.startMs);

  if (videoClips.length === 0) {
    throw new Error("TIMELINE_EMPTY");
  }

  const outputPath = await save({
    title: dialogTitle,
    defaultPath: defaultName,
    filters: [{ name: "MP4", extensions: ["mp4"] }],
  });

  if (!outputPath) return null;

  const payload: TimelineExportClipInput[] = videoClips.map((clip) => ({
    filePath: clip.sourcePath,
    sourceOffsetMs: clip.sourceOffsetMs,
    durationMs: clip.durationMs,
  }));

  await invoke("export_timeline", {
    input: {
      clips: payload,
      outputPath,
    },
  });

  return outputPath;
}
