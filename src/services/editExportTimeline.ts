export interface TimelineClipRecord {
  instanceId: string;
  groupId: string;
  sourceVideoId: number;
  name: string;
  src: string;
  sourcePath: string;
  track: "video" | "audio";
  startMs: number;
  sourceOffsetMs: number;
  durationMs: number;
  sourceDurationMs: number;
}

const STORAGE_PREFIX = "textflow-edit-timeline:";

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function loadTimelineClips(projectId: string): TimelineClipRecord[] | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimelineClipRecord[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTimelineClips(
  projectId: string,
  clips: TimelineClipRecord[],
): void {
  localStorage.setItem(storageKey(projectId), JSON.stringify(clips));
}

export function clearTimelineClips(projectId: string): void {
  localStorage.removeItem(storageKey(projectId));
}
