import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faFilm,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ProjectAssetRecord } from "../services/assets";
import { exportTimelineVideo } from "../services/editExport";
import {
  loadTimelineClips,
  saveTimelineClips,
  type TimelineClipRecord,
} from "../services/editExportTimeline";
import { SCRIPT_STATE_SUCCESS, type ScriptRecord } from "../services/script";
import {
  msToWidth,
  TimelineClipBlock,
  widthToMs,
} from "./editExport/TimelineClipBlock";
import { VideoFirstFrameCover } from "./editExport/VideoFirstFrameCover";

const DRAG_MIME = "application/x-textflow-video";
const DEFAULT_CLIP_DURATION_MS = 5000;
const MIN_TIMELINE_MS = 10_000;
const SNAP_MS = 100;

interface EditExportStepProps {
  projectId: string;
  projectName: string;
  title: string;
  scripts: ScriptRecord[];
  videos: ProjectAssetRecord[];
  onConfigError: (message: string | null) => void;
}

interface VideoLibraryItem {
  sourceVideoId: number;
  episodeIndex: number;
  name: string;
  src: string;
  sourcePath: string;
  durationMs: number;
}

interface DragVideoPayload {
  sourceVideoId: number;
  name: string;
  src: string;
  sourcePath: string;
  durationMs: number;
}

function buildLatestVideoMap(
  videos: ProjectAssetRecord[],
): Map<string, ProjectAssetRecord> {
  const map = new Map<string, ProjectAssetRecord>();
  for (const video of videos) {
    if (video.assetType !== "video") continue;
    const existing = map.get(video.name);
    if (!existing || video.createdAt > existing.createdAt) {
      map.set(video.name, video);
    }
  }
  return map;
}

function formatTimecode(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((ms % 1000) / (1000 / 24));
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

function createGroupId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function snapMs(ms: number): number {
  return Math.round(ms / SNAP_MS) * SNAP_MS;
}

function buildClipPair(
  payload: DragVideoPayload,
  startMs: number,
): TimelineClipRecord[] {
  const groupId = createGroupId();
  const durationMs = payload.durationMs || DEFAULT_CLIP_DURATION_MS;
  const base = {
    groupId,
    sourceVideoId: payload.sourceVideoId,
    name: payload.name,
    src: payload.src,
    sourcePath: payload.sourcePath,
    startMs: snapMs(Math.max(0, startMs)),
    sourceOffsetMs: 0,
    durationMs,
    sourceDurationMs: durationMs,
  };

  return [
    { ...base, instanceId: `${groupId}-video`, track: "video" },
    { ...base, instanceId: `${groupId}-audio`, track: "audio" },
  ];
}

function buildSequentialTimeline(items: VideoLibraryItem[]): TimelineClipRecord[] {
  let cursor = 0;
  const clips: TimelineClipRecord[] = [];

  for (const item of items) {
    clips.push(
      ...buildClipPair(
        {
          sourceVideoId: item.sourceVideoId,
          name: item.name,
          src: item.src,
          sourcePath: item.sourcePath,
          durationMs: item.durationMs,
        },
        cursor,
      ),
    );
    cursor += item.durationMs;
  }

  return clips;
}

function updateClipGroup(
  clips: TimelineClipRecord[],
  groupId: string,
  patch: Partial<
    Pick<TimelineClipRecord, "startMs" | "sourceOffsetMs" | "durationMs">
  >,
): TimelineClipRecord[] {
  return clips.map((clip) =>
    clip.groupId === groupId ? { ...clip, ...patch } : clip,
  );
}

function hasVideoOverlap(clips: TimelineClipRecord[]): boolean {
  const videos = clips
    .filter((clip) => clip.track === "video")
    .sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < videos.length; i++) {
    const prevEnd = videos[i - 1].startMs + videos[i - 1].durationMs;
    if (prevEnd > videos[i].startMs + 50) return true;
  }
  return false;
}

function reflowVideoStarts(clips: TimelineClipRecord[]): TimelineClipRecord[] {
  const videos = clips
    .filter((clip) => clip.track === "video")
    .sort((a, b) => a.startMs - b.startMs);
  let cursor = 0;
  const starts = new Map<string, number>();
  for (const video of videos) {
    starts.set(video.groupId, cursor);
    cursor += video.durationMs;
  }
  return clips.map((clip) => {
    const nextStart = starts.get(clip.groupId);
    if (nextStart == null) return clip;
    return { ...clip, startMs: nextStart };
  });
}

function removeLeadingGap(clips: TimelineClipRecord[]): TimelineClipRecord[] {
  const videoStarts = clips
    .filter((clip) => clip.track === "video")
    .map((clip) => clip.startMs);
  if (videoStarts.length === 0) return clips;

  const minStart = Math.min(...videoStarts);
  if (minStart <= 0) return clips;

  return clips.map((clip) => ({
    ...clip,
    startMs: clip.startMs - minStart,
  }));
}

function normalizeTimelineClips(clips: TimelineClipRecord[]): TimelineClipRecord[] {
  let next = clips;
  if (hasVideoOverlap(next)) {
    next = reflowVideoStarts(next);
  }
  return removeLeadingGap(next);
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

export function EditExportStep({
  projectId,
  projectName,
  title,
  scripts,
  videos,
  onConfigError,
}: EditExportStepProps) {
  const s = useTranslationMessages().creation.editExportStep;
  const [clips, setClips] = useState<TimelineClipRecord[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durations, setDurations] = useState<Record<number, number>>({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const suppressTimelineClickRef = useRef(false);
  const libraryDragActiveRef = useRef(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const isPlayingRef = useRef(false);
  const playheadMsRef = useRef(0);
  const activeClipRef = useRef<TimelineClipRecord | null>(null);
  const videoTrackClipsRef = useRef<TimelineClipRecord[]>([]);

  const videoMap = useMemo(() => buildLatestVideoMap(videos), [videos]);

  const libraryItems = useMemo(() => {
    const sorted = [...scripts].sort((a, b) => a.episodeIndex - b.episodeIndex);
    const items: VideoLibraryItem[] = [];

    for (const script of sorted) {
      if (script.scriptState !== SCRIPT_STATE_SUCCESS) continue;
      const video = videoMap.get(script.name);
      if (!video?.imagePath) continue;

      items.push({
        sourceVideoId: video.id,
        episodeIndex: script.episodeIndex,
        name: script.name,
        src: convertFileSrc(video.imagePath),
        sourcePath: video.imagePath,
        durationMs: durations[video.id] ?? DEFAULT_CLIP_DURATION_MS,
      });
    }

    return items;
  }, [durations, scripts, videoMap]);

  useEffect(() => {
    for (const item of libraryItems) {
      if (durations[item.sourceVideoId]) continue;
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = item.src;
      probe.onloadedmetadata = () => {
        const durationMs =
          Number.isFinite(probe.duration) && probe.duration > 0
            ? Math.round(probe.duration * 1000)
            : DEFAULT_CLIP_DURATION_MS;
        setDurations((prev) => ({
          ...prev,
          [item.sourceVideoId]: durationMs,
        }));
      };
    }
  }, [durations, libraryItems]);

  useEffect(() => {
    if (initialized || libraryItems.length === 0) return;

    const saved = loadTimelineClips(projectId);
    if (saved && saved.length > 0) {
      setClips(normalizeTimelineClips(saved));
    } else {
      setClips(buildSequentialTimeline(libraryItems));
    }
    setInitialized(true);
  }, [initialized, libraryItems, projectId]);

  useEffect(() => {
    if (!initialized) return;
    saveTimelineClips(projectId, clips);
  }, [clips, initialized, projectId]);

  const videoTrackClips = useMemo(
    () =>
      clips
        .filter((clip) => clip.track === "video")
        .sort((a, b) => a.startMs - b.startMs),
    [clips],
  );

  const audioTrackClips = useMemo(
    () =>
      clips
        .filter((clip) => clip.track === "audio")
        .sort((a, b) => a.startMs - b.startMs),
    [clips],
  );

  useEffect(() => {
    if (!initialized) return;
    setClips((prev) => {
      let changed = false;
      let next = prev.map((clip) => {
        const probed = durations[clip.sourceVideoId];
        if (!probed || probed === clip.sourceDurationMs) return clip;
        changed = true;
        if (clip.sourceOffsetMs === 0 && clip.durationMs === clip.sourceDurationMs) {
          return { ...clip, durationMs: probed, sourceDurationMs: probed };
        }
        return { ...clip, sourceDurationMs: probed };
      });
      if (changed) {
        next = normalizeTimelineClips(next);
      }
      return changed ? next : prev;
    });
  }, [durations, initialized]);

  const timelineDurationMs = useMemo(() => {
    const clipEnd = clips.reduce(
      (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
      0,
    );
    return Math.max(MIN_TIMELINE_MS, clipEnd + 2000);
  }, [clips]);

  const timelineWidth = msToWidth(timelineDurationMs);

  const activeVideoClip = useMemo(
    () =>
      videoTrackClips.find(
        (clip) =>
          playheadMs >= clip.startMs &&
          playheadMs < clip.startMs + clip.durationMs,
      ) ?? null,
    [playheadMs, videoTrackClips],
  );

  isPlayingRef.current = isPlaying;
  playheadMsRef.current = playheadMs;
  activeClipRef.current = activeVideoClip;
  videoTrackClipsRef.current = videoTrackClips;

  const seekPreviewToPlayhead = useCallback(
    (clip: TimelineClipRecord, playhead: number) => {
      const video = previewRef.current;
      if (!video) return;

      const targetSec =
        (playhead - clip.startMs + clip.sourceOffsetMs) / 1000;

      const applySeek = () => {
        if (Math.abs(video.currentTime - targetSec) > 0.08) {
          video.currentTime = targetSec;
        }
      };

      if (video.readyState >= 1) {
        applySeek();
      } else {
        video.addEventListener("loadedmetadata", applySeek, { once: true });
      }
    },
    [],
  );

  useEffect(() => {
    const video = previewRef.current;
    if (!video || !activeVideoClip || isPlaying) return;

    if (video.src !== activeVideoClip.src) {
      video.src = activeVideoClip.src;
    }
    seekPreviewToPlayhead(activeVideoClip, playheadMs);
  }, [activeVideoClip, isPlaying, playheadMs, seekPreviewToPlayhead]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video || !activeVideoClip) return;

    if (!isPlaying) {
      video.pause();
      return;
    }

    const startPlayback = () => {
      seekPreviewToPlayhead(activeVideoClip, playheadMsRef.current);
      void video.play().catch(() => setIsPlaying(false));
    };

    if (video.src !== activeVideoClip.src) {
      video.src = activeVideoClip.src;
      video.addEventListener("loadeddata", startPlayback, { once: true });
      return;
    }

    startPlayback();
  }, [activeVideoClip, isPlaying, seekPreviewToPlayhead]);

  const syncPlayheadFromVideo = useCallback(() => {
    const video = previewRef.current;
    const clip = activeClipRef.current;
    if (!video || !clip) return;

    const ms = clip.startMs + video.currentTime * 1000 - clip.sourceOffsetMs;
    const clipEnd = clip.startMs + clip.durationMs;
    setPlayheadMs(Math.max(clip.startMs, Math.min(clipEnd, ms)));
  }, []);

  const advanceToNextClip = useCallback((clip: TimelineClipRecord) => {
    const trackClips = videoTrackClipsRef.current;
    const index = trackClips.findIndex((c) => c.groupId === clip.groupId);
    const clipEnd = clip.startMs + clip.durationMs;
    if (index >= 0 && index < trackClips.length - 1) {
      setPlayheadMs(trackClips[index + 1].startMs);
      return;
    }
    setIsPlaying(false);
    setPlayheadMs(clipEnd);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;

    const tick = () => {
      if (!isPlayingRef.current) return;

      const video = previewRef.current;
      const clip = activeClipRef.current;
      if (video && clip) {
        const ms =
          clip.startMs + video.currentTime * 1000 - clip.sourceOffsetMs;
        const clipEnd = clip.startMs + clip.durationMs;

        if (ms >= clipEnd - 50 || video.ended) {
          advanceToNextClip(clip);
          return;
        }

        setPlayheadMs(Math.max(clip.startMs, ms));
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [advanceToNextClip, isPlaying, activeVideoClip?.instanceId]);

  useEffect(() => {
    if (!isPlaying || activeVideoClip) return;

    const nextClip = videoTrackClips.find((clip) => clip.startMs >= playheadMs);
    if (nextClip) {
      setPlayheadMs(nextClip.startMs);
      return;
    }

    setIsPlaying(false);
  }, [activeVideoClip, isPlaying, playheadMs, videoTrackClips]);

  const togglePlayPause = useCallback(() => {
    if (videoTrackClips.length === 0) return;
    setIsPlaying((value) => !value);
  }, [videoTrackClips.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      event.preventDefault();
      togglePlayPause();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlayPause]);

  const addClipToTimeline = useCallback((payload: DragVideoPayload, startMs: number) => {
    setClips((prev) => [...prev, ...buildClipPair(payload, startMs)]);
  }, []);

  const isLibraryDrag = useCallback((event: DragEvent) => {
    if (libraryDragActiveRef.current) return true;
    const types = Array.from(event.dataTransfer.types);
    return types.includes(DRAG_MIME) || types.includes("text/plain");
  }, []);

  const handleLibraryDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, item: VideoLibraryItem) => {
      const payload: DragVideoPayload = {
        sourceVideoId: item.sourceVideoId,
        name: item.name,
        src: item.src,
        sourcePath: item.sourcePath,
        durationMs: item.durationMs,
      };
      const serialized = JSON.stringify(payload);
      libraryDragActiveRef.current = true;
      event.dataTransfer.setData(DRAG_MIME, serialized);
      event.dataTransfer.setData("text/plain", serialized);
      event.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  const handleLibraryDragEnd = useCallback(() => {
    libraryDragActiveRef.current = false;
  }, []);

  const resolveDropStartMs = useCallback((clientX: number) => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) return 0;
    const rect = scrollEl.getBoundingClientRect();
    const x = clientX - rect.left + scrollEl.scrollLeft;
    return snapMs(widthToMs(Math.max(0, x)));
  }, []);

  const handleTrackDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isLibraryDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    [isLibraryDrag],
  );

  const handleTrackDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isLibraryDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    },
    [isLibraryDrag],
  );

  const handleTrackDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isLibraryDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      libraryDragActiveRef.current = false;

      const raw =
        event.dataTransfer.getData(DRAG_MIME) ||
        event.dataTransfer.getData("text/plain");
      if (!raw) return;

      try {
        const payload = JSON.parse(raw) as DragVideoPayload;
        const startMs = resolveDropStartMs(event.clientX);
        addClipToTimeline(payload, startMs);
        setPlayheadMs(startMs);
      } catch {
        // ignore invalid payload
      }
    },
    [addClipToTimeline, isLibraryDrag, resolveDropStartMs],
  );

  const handleClipDragEnd = useCallback((moved: boolean) => {
    if (moved) {
      suppressTimelineClickRef.current = true;
    }
  }, []);

  const seekTimelineAtClientX = useCallback((clientX: number) => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) return;
    const rect = scrollEl.getBoundingClientRect();
    const x = clientX - rect.left + scrollEl.scrollLeft;
    setPlayheadMs(snapMs(widthToMs(Math.max(0, x))));
    setIsPlaying(false);
  }, []);

  const handleTimelineClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (suppressTimelineClickRef.current) {
        suppressTimelineClickRef.current = false;
        return;
      }
      if ((event.target as HTMLElement).closest("[data-timeline-clip]")) {
        return;
      }
      seekTimelineAtClientX(event.clientX);
    },
    [seekTimelineAtClientX],
  );

  const handleMoveClip = useCallback((groupId: string, startMs: number) => {
    setClips((prev) =>
      updateClipGroup(prev, groupId, { startMs: snapMs(Math.max(0, startMs)) }),
    );
  }, []);

  const handleTrimClip = useCallback(
    (
      groupId: string,
      patch: Partial<
        Pick<TimelineClipRecord, "startMs" | "sourceOffsetMs" | "durationMs">
      >,
    ) => {
      setClips((prev) => updateClipGroup(prev, groupId, patch));
    },
    [],
  );

  const removeClipGroup = useCallback((groupId: string) => {
    setClips((prev) => prev.filter((clip) => clip.groupId !== groupId));
  }, []);

  const handleFillTimeline = useCallback(() => {
    setClips(buildSequentialTimeline(libraryItems));
    setPlayheadMs(0);
    setIsPlaying(false);
  }, [libraryItems]);

  const handleClearTimeline = useCallback(() => {
    setClips([]);
    setPlayheadMs(0);
    setIsPlaying(false);
  }, []);

  const handleExport = useCallback(async () => {
    if (exporting || videoTrackClips.length === 0) return;
    setExporting(true);
    setExportError(null);
    setExportNotice(null);
    onConfigError(null);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const output = await exportTimelineVideo(
        clips,
        s.exportDialogTitle,
        `${projectName || "project"}-${timestamp}.mp4`,
      );
      if (output) {
        setExportNotice(s.exportSuccess(output));
        onConfigError(null);
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      const displayMessage =
        message === "TIMELINE_EMPTY" ? s.exportEmpty : message || s.exportFailed;
      setExportError(displayMessage);
      onConfigError(displayMessage);
    } finally {
      setExporting(false);
    }
  }, [
    clips,
    exporting,
    onConfigError,
    projectName,
    s.exportDialogTitle,
    s.exportEmpty,
    s.exportFailed,
    s.exportSuccess,
    videoTrackClips.length,
  ]);

  const rulerMarks = useMemo(() => {
    const marks: number[] = [];
    for (let ms = 0; ms <= timelineDurationMs; ms += 1000) {
      marks.push(ms);
    }
    return marks;
  }, [timelineDurationMs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h2 className="step-panel-title w-fit min-w-0 shrink self-start">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleFillTimeline}
            disabled={libraryItems.length === 0}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-text-muted transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s.fillTimeline}
          </button>
          <button
            type="button"
            onClick={handleClearTimeline}
            disabled={clips.length === 0}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-text-muted transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s.clearTimeline}
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || videoTrackClips.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FontAwesomeIcon
              icon={exporting ? faSpinner : faDownload}
              spin={exporting}
            />
            {exporting ? s.exporting : s.export}
          </button>
        </div>
      </div>

      {exportError ? (
        <p className="mt-3 shrink-0 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {exportError}
        </p>
      ) : exportNotice ? (
        <p className="mt-3 shrink-0 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-sm text-accent">
          {exportNotice}
        </p>
      ) : null}

      <div className="mt-4 flex min-h-0 flex-1 gap-4 overflow-hidden">
        <aside className="flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-surface/20 sm:w-64">
          <div className="border-b border-white/10 px-3 py-2.5">
            <p className="text-xs font-medium text-white">{s.libraryTitle}</p>
            <p className="mt-0.5 text-[11px] text-text-muted">{s.libraryHint}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {libraryItems.length > 0 ? (
              <div className="space-y-2">
                {libraryItems.map((item) => (
                  <button
                    key={item.sourceVideoId}
                    type="button"
                    draggable
                    onDragStart={(event) => handleLibraryDragStart(event, item)}
                    onDragEnd={handleLibraryDragEnd}
                    className="group w-full cursor-grab rounded-lg border border-white/10 bg-black/25 p-2 text-left transition hover:border-sky-400/30 hover:bg-black/40 active:cursor-grabbing"
                  >
                    <div className="overflow-hidden rounded-md border border-white/10 bg-black/40">
                      <VideoFirstFrameCover
                        src={item.src}
                        className="aspect-video w-full object-cover"
                      />
                    </div>
                    <p className="mt-2 truncate text-xs font-medium text-white">
                      {s.episodeLabel(item.episodeIndex)}
                    </p>
                    <p className="truncate text-[11px] text-text-muted">{item.name}</p>
                    <p className="mt-1 text-[10px] text-text-dim">
                      {formatTimecode(item.durationMs)}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-1 py-6 text-center text-xs leading-relaxed text-text-muted">
                {s.libraryEmpty}
              </p>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-surface/20">
          <div className="flex min-h-0 flex-[3] flex-col border-b border-white/10">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
              <p className="text-xs font-medium text-text-muted">{s.previewTitle}</p>
              <span className="font-mono text-xs text-text-muted">
                {formatTimecode(playheadMs)} / {formatTimecode(timelineDurationMs)}
              </span>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-black/50 p-4">
              {activeVideoClip ? (
                <video
                  ref={previewRef}
                  src={activeVideoClip.src}
                  controls={!isPlaying}
                  playsInline
                  disablePictureInPicture
                  className="max-h-full max-w-full rounded-md object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onSeeked={() => {
                    if (!isPlayingRef.current) syncPlayheadFromVideo();
                  }}
                  onEnded={() => {
                    const clip = activeClipRef.current;
                    if (clip) advanceToNextClip(clip);
                  }}
                />
              ) : (
                <div className="text-center">
                  <FontAwesomeIcon icon={faFilm} className="text-3xl text-text-dim" />
                  <p className="mt-3 text-sm text-text-muted">{s.previewEmpty}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-[240px] flex-[2] flex-col">
            <div className="flex shrink-0 items-center border-b border-white/10 px-4 py-2">
              <p className="text-xs font-medium text-text-muted">{s.timelineTitle}</p>
            </div>

            <div
              ref={timelineScrollRef}
              className="min-h-0 flex-1 select-none overflow-x-auto overflow-y-hidden"
            >
              <div
                className="relative min-h-full"
                style={{ width: Math.max(timelineWidth, 720) }}
              >
                <div
                  className="relative cursor-pointer"
                  onClick={handleTimelineClick}
                  onDragEnter={handleTrackDragEnter}
                  onDragOver={handleTrackDragOver}
                  onDrop={handleTrackDrop}
                >
                  <div className="relative h-7 border-b border-white/10 bg-black/30">
                    {rulerMarks.map((ms) => (
                      <div
                        key={ms}
                        className="absolute top-0 h-full border-l border-white/10"
                        style={{ left: msToWidth(ms) }}
                      >
                        <span
                          className={`text-[10px] text-text-dim ${ms === 0 ? "pl-0.5" : "ml-1"}`}
                        >
                          {formatTimecode(ms).slice(0, 5)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="relative">
                    <div className="relative z-20 border-b border-white/5">
                      <div className="relative min-h-[56px] bg-black/20">
                      {videoTrackClips.map((clip, index) => (
                        <TimelineClipBlock
                          key={clip.instanceId}
                          clip={clip}
                          zIndex={index + 1}
                          removeLabel={s.removeClip}
                          onMove={handleMoveClip}
                          onTrim={handleTrimClip}
                          onRemove={removeClipGroup}
                          onDragEnd={handleClipDragEnd}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="relative z-10">
                    <div className="relative min-h-[56px] bg-black/15">
                      {audioTrackClips.map((clip, index) => (
                        <TimelineClipBlock
                          key={clip.instanceId}
                          clip={clip}
                          zIndex={index + 1}
                          variant="audio"
                          removeLabel={s.removeClip}
                          onMove={handleMoveClip}
                          onTrim={handleTrimClip}
                          onRemove={removeClipGroup}
                          onDragEnd={handleClipDragEnd}
                        />
                      ))}
                    </div>
                  </div>

                    <div
                      className="pointer-events-none absolute bottom-0 top-0 z-[5] w-0"
                      style={{ left: msToWidth(playheadMs) }}
                    >
                      <div className="absolute -left-px top-0 h-full w-px bg-accent" />
                      <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-accent" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
