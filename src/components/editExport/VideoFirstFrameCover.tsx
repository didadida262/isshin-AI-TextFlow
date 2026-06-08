import { useCallback } from "react";

const COVER_SEEK_SEC = 0.1;

interface VideoFirstFrameCoverProps {
  src: string;
  className?: string;
}

export function VideoFirstFrameCover({ src, className }: VideoFirstFrameCoverProps) {
  const seekToCoverFrame = useCallback((video: HTMLVideoElement) => {
    const duration = video.duration;
    const target =
      Number.isFinite(duration) && duration > 0
        ? Math.min(COVER_SEEK_SEC, duration * 0.01)
        : COVER_SEEK_SEC;

    video.pause();
    if (Math.abs(video.currentTime - target) > 0.02) {
      video.currentTime = target;
    }
  }, []);

  return (
    <video
      src={src}
      muted
      playsInline
      preload="auto"
      draggable={false}
      className={`pointer-events-none ${className ?? ""}`}
      onLoadedData={(event) => seekToCoverFrame(event.currentTarget)}
      onSeeked={(event) => event.currentTarget.pause()}
    />
  );
}
