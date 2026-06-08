import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClapperboard } from "@fortawesome/free-solid-svg-icons";

interface VideoThumbnailProps {
  src: string;
  alt: string;
  className?: string;
}

function ClapperboardFallback({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <span className="flex h-full w-full items-center justify-center bg-sky-400/10">
      <FontAwesomeIcon
        icon={faClapperboard}
        className={`text-xl ${dimmed ? "text-sky-300/60" : "text-sky-300"}`}
      />
    </span>
  );
}

function pickSeekTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(0.1, duration * 0.01);
}

function captureVideoFrame(video: HTMLVideoElement): string | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(video, 0, 0, width, height);
  try {
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

export function VideoThumbnail({
  src,
  alt,
  className = "h-14 w-14 object-cover",
}: VideoThumbnailProps) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [showInlineVideo, setShowInlineVideo] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPosterUrl(null);
    setShowInlineVideo(false);
    setFailed(false);
    setLoading(true);

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("webkit-playsinline", "true");
    video.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none";
    video.src = src;
    document.body.appendChild(video);

    const finish = (dataUrl: string | null, canUseInlineVideo: boolean) => {
      if (cancelled) return;
      if (dataUrl) {
        setPosterUrl(dataUrl);
        setLoading(false);
        return;
      }
      if (canUseInlineVideo) {
        setShowInlineVideo(true);
        setLoading(false);
        return;
      }
      setFailed(true);
      setLoading(false);
    };

    const seekAndCapture = () => {
      if (cancelled) return;
      const targetTime = pickSeekTime(video.duration);
      const capture = () => {
        video.pause();
        const dataUrl = captureVideoFrame(video);
        finish(
          dataUrl,
          !dataUrl && video.videoWidth > 0 && video.videoHeight > 0,
        );
      };

      if (Math.abs(video.currentTime - targetTime) > 0.0001) {
        video.addEventListener("seeked", capture, { once: true });
        try {
          video.currentTime = targetTime;
        } catch {
          finish(null, false);
        }
      } else {
        capture();
      }
    };

    video.addEventListener("error", () => finish(null, false), { once: true });
    video.addEventListener("loadeddata", seekAndCapture, { once: true });

    return () => {
      cancelled = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
    };
  }, [src]);

  if (failed) {
    return <ClapperboardFallback />;
  }

  if (showInlineVideo) {
    return (
      <span className="relative block h-14 w-14 overflow-hidden">
        <video
          src={`${src}#t=0.001`}
          muted
          playsInline
          preload="auto"
          aria-label={alt}
          className={`${className} pointer-events-none`}
          onLoadedData={(event) => {
            const video = event.currentTarget;
            const targetTime = pickSeekTime(video.duration);
            if (Math.abs(video.currentTime - targetTime) > 0.0001) {
              video.currentTime = targetTime;
            } else {
              video.pause();
            }
          }}
          onSeeked={(event) => {
            event.currentTarget.pause();
          }}
        />
      </span>
    );
  }

  return (
    <span className="relative block h-14 w-14 overflow-hidden">
      {loading ? (
        <span className="absolute inset-0">
          <ClapperboardFallback dimmed />
        </span>
      ) : null}
      {posterUrl ? (
        <img src={posterUrl} alt={alt} className={className} />
      ) : null}
    </span>
  );
}
