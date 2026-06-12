import { useEffect, useMemo, useState } from "react";
import {
  loadWaveformPeaks,
  sliceWaveformPeaks,
  waveformBarCountForWidth,
} from "../../services/audioWaveform";
import { msToWidth } from "./timelineLayout";

interface AudioWaveformBarsProps {
  src: string;
  sourcePath: string;
  sourceOffsetMs: number;
  durationMs: number;
}

export function AudioWaveformBars({
  src,
  sourcePath,
  sourceOffsetMs,
  durationMs,
}: AudioWaveformBarsProps) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const clipWidth = Math.max(msToWidth(durationMs), 24);
  const barCount = waveformBarCountForWidth(clipWidth);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);

    void loadWaveformPeaks(sourcePath, src)
      .then((loaded) => {
        if (!cancelled) setPeaks(loaded);
      })
      .catch(() => {
        if (!cancelled) setPeaks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [sourcePath, src]);

  const bars = useMemo(() => {
    if (!peaks || peaks.length === 0) {
      return Array.from({ length: barCount }, (_, index) =>
        peaks ? 0.12 : 0.18 + ((index * 7) % 5) * 0.04,
      );
    }
    return sliceWaveformPeaks(peaks, sourceOffsetMs, durationMs, barCount);
  }, [barCount, durationMs, peaks, sourceOffsetMs]);

  return (
    <div className="pointer-events-none relative z-0 flex h-full w-full items-end gap-px px-1 pb-1">
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-1 rounded-sm bg-emerald-300/70 transition-[height] duration-150"
          style={{ height: `${Math.round(height * 100)}%` }}
        />
      ))}
    </div>
  );
}
