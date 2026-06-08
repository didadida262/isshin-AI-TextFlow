import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import type { TimelineClipRecord } from "../../services/editExportTimeline";

const MIN_CLIP_DURATION_MS = 500;
const TRIM_EDGE_PX = 10;
const DRAG_THRESHOLD_PX = 3;

export const PIXELS_PER_SECOND = 40;

export function msToWidth(ms: number): number {
  return (ms / 1000) * PIXELS_PER_SECOND;
}

export function widthToMs(width: number): number {
  return Math.max(0, (width / PIXELS_PER_SECOND) * 1000);
}

interface TimelineClipBlockProps {
  clip: TimelineClipRecord;
  removeLabel: string;
  zIndex?: number;
  variant?: "video" | "audio";
  onMove: (groupId: string, startMs: number) => void;
  onTrim: (
    groupId: string,
    patch: Partial<
      Pick<TimelineClipRecord, "startMs" | "sourceOffsetMs" | "durationMs">
    >,
  ) => void;
  onRemove: (groupId: string) => void;
  onDragEnd?: (moved: boolean) => void;
}

type DragMode = "move" | "trim-left" | "trim-right";

export function TimelineClipBlock({
  clip,
  removeLabel,
  zIndex = 1,
  variant = "video",
  onMove,
  onTrim,
  onRemove,
  onDragEnd,
}: TimelineClipBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    mode: DragMode;
    groupId: string;
    sourceDurationMs: number;
    originX: number;
    startMs: number;
    sourceOffsetMs: number;
    durationMs: number;
    moved: boolean;
  } | null>(null);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (drag) {
      onDragEnd?.(drag.moved);
    }
  }, [onDragEnd]);

  const applyDrag = useCallback(
    (clientX: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (Math.abs(clientX - drag.originX) > DRAG_THRESHOLD_PX) {
        drag.moved = true;
      }

      const deltaMs = widthToMs(clientX - drag.originX);
      if (drag.mode === "move") {
        onMove(drag.groupId, Math.max(0, drag.startMs + deltaMs));
        return;
      }

      if (drag.mode === "trim-left") {
        const maxDelta = drag.durationMs - MIN_CLIP_DURATION_MS;
        const applied = Math.min(maxDelta, Math.max(-drag.sourceOffsetMs, deltaMs));
        onTrim(drag.groupId, {
          startMs: drag.startMs + applied,
          sourceOffsetMs: drag.sourceOffsetMs + applied,
          durationMs: drag.durationMs - applied,
        });
        return;
      }

      const maxDelta =
        drag.sourceDurationMs - drag.sourceOffsetMs - MIN_CLIP_DURATION_MS;
      const applied = Math.min(
        maxDelta,
        Math.max(-(drag.durationMs - MIN_CLIP_DURATION_MS), deltaMs),
      );
      onTrim(drag.groupId, {
        durationMs: drag.durationMs + applied,
      });
    },
    [onMove, onTrim],
  );

  const startDrag = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = event.currentTarget.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      let mode: DragMode = "move";
      if (offsetX < TRIM_EDGE_PX) {
        mode = "trim-left";
      } else if (offsetX > rect.width - TRIM_EDGE_PX) {
        mode = "trim-right";
      }

      dragRef.current = {
        mode,
        groupId: clip.groupId,
        sourceDurationMs: clip.sourceDurationMs,
        originX: event.clientX,
        startMs: clip.startMs,
        sourceOffsetMs: clip.sourceOffsetMs,
        durationMs: clip.durationMs,
        moved: false,
      };
      setIsDragging(true);

      const onMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        applyDrag(moveEvent.clientX);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        finishDrag();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [applyDrag, clip, finishDrag],
  );

  const isVideo = variant === "video";

  return (
    <div
      data-timeline-clip
      className={`absolute top-2 flex h-10 select-none items-center overflow-hidden rounded border px-2 ${
        isVideo
          ? "cursor-grab border-sky-400/40 bg-sky-500/20 active:cursor-grabbing"
          : "cursor-grab border-emerald-400/30 bg-emerald-500/15 active:cursor-grabbing"
      } ${isDragging ? "cursor-grabbing" : ""}`}
      style={{
        left: msToWidth(clip.startMs),
        width: Math.max(msToWidth(clip.durationMs), 24),
        zIndex: isDragging ? 50 : zIndex,
      }}
      onMouseDown={startDrag}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-2 bg-white/10" />
      {isVideo ? (
        <>
          <span className="pointer-events-none relative z-0 truncate px-2 text-[10px] text-sky-100">
            {clip.name}
          </span>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(clip.groupId);
            }}
            className="relative z-20 ml-auto shrink-0 pl-2 text-sky-200/70 hover:text-white"
            aria-label={removeLabel}
          >
            <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
          </button>
        </>
      ) : (
        <div className="pointer-events-none relative z-0 flex h-full w-full items-end gap-px px-1 pb-1">
          {Array.from({ length: 16 }).map((_, index) => (
            <span
              key={index}
              className="w-1 rounded-sm bg-emerald-300/50"
              style={{
                height: `${28 + ((index * 13) % 60)}%`,
              }}
            />
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-2 bg-white/10" />
    </div>
  );
}
