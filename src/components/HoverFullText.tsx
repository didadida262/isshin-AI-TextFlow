import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface HoverFullTextProps {
  text: string;
  className?: string;
  previewClassName?: string;
  /** 表格内最多展示行数，超出省略 */
  lines?: 1 | 2;
}

const HIDE_DELAY_MS = 280;
const BRIDGE_PX = 10;
const PREVIEW_MAX_HEIGHT = 240;

function normalizeDisplayText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function HoverFullText({
  text,
  className = "",
  previewClassName = "",
  lines = 2,
}: HoverFullTextProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    placement: "below" as "above" | "below",
  });

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const previewWidth = Math.min(Math.max(rect.width, 280), 480);
    const margin = 8;
    let left = rect.left;

    if (left + previewWidth > window.innerWidth - margin) {
      left = window.innerWidth - previewWidth - margin;
    }
    if (left < margin) left = margin;

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const placement =
      spaceBelow >= PREVIEW_MAX_HEIGHT || spaceBelow >= spaceAbove
        ? "below"
        : "above";

    const top =
      placement === "below"
        ? rect.bottom - BRIDGE_PX
        : rect.top - PREVIEW_MAX_HEIGHT;

    setPosition({ top, left, width: previewWidth, placement });
  }, []);

  const showPreview = useCallback(() => {
    const normalized = normalizeDisplayText(text);
    if (!normalized) return;
    clearHideTimer();
    updatePosition();
    setOpen(true);
  }, [clearHideTimer, text, updatePosition]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  }, [clearHideTimer]);

  useEffect(() => {
    if (!open) return;

    const handleReposition = () => updatePosition();

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        setOpen(false);
        return;
      }
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const displayText = normalizeDisplayText(text);
  const clampClass = lines === 1 ? "truncate" : "text-clamp-2";

  return (
    <>
      <div
        ref={triggerRef}
        className={`min-w-0 w-full cursor-default leading-relaxed ${clampClass} ${className}`}
        onMouseEnter={showPreview}
        onMouseLeave={scheduleHide}
        onFocus={showPreview}
        onBlur={scheduleHide}
        tabIndex={0}
      >
        {displayText || "—"}
      </div>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999]"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              paddingTop: position.placement === "below" ? BRIDGE_PX : 0,
              paddingBottom: position.placement === "above" ? BRIDGE_PX : 0,
            }}
            onMouseEnter={showPreview}
            onMouseLeave={scheduleHide}
          >
            <div
              className={`max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm leading-relaxed text-white shadow-2xl ring-1 ring-black/40 ${previewClassName}`}
              onWheel={(event) => event.stopPropagation()}
            >
              <p className="whitespace-pre-wrap break-words">{text}</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
