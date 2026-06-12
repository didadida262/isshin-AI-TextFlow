import { invoke, isTauri } from "@tauri-apps/api/core";

const PEAKS_PER_SECOND = 40;
const MIN_BAR_HEIGHT = 0.12;
const waveformCache = new Map<string, Promise<number[]>>();

function mergeChannelPeaks(audioBuffer: AudioBuffer): Float32Array {
  const { length, numberOfChannels } = audioBuffer;
  const merged = new Float32Array(length);

  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const amplitude = Math.abs(data[index] ?? 0);
      if (amplitude > merged[index]) {
        merged[index] = amplitude;
      }
    }
  }

  return merged;
}

async function decodeWaveformPeaksFromFile(sourcePath: string): Promise<number[]> {
  return invoke<number[]>("extract_audio_waveform", { filePath: sourcePath });
}

async function decodeWaveformPeaksFromUrl(src: string): Promise<number[]> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`无法读取音频: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const samples = mergeChannelPeaks(audioBuffer);
    const samplesPerPeak = Math.max(
      1,
      Math.floor(audioBuffer.sampleRate / PEAKS_PER_SECOND),
    );
    const peaks: number[] = [];

    for (let index = 0; index < samples.length; index += samplesPerPeak) {
      let peak = 0;
      const end = Math.min(index + samplesPerPeak, samples.length);
      for (let cursor = index; cursor < end; cursor += 1) {
        peak = Math.max(peak, samples[cursor] ?? 0);
      }
      peaks.push(peak);
    }

    return peaks;
  } finally {
    await audioContext.close();
  }
}

export function loadWaveformPeaks(sourcePath: string, src: string): Promise<number[]> {
  const cacheKey = sourcePath || src;
  const cached = waveformCache.get(cacheKey);
  if (cached) return cached;

  const pending = (
    isTauri() && sourcePath
      ? decodeWaveformPeaksFromFile(sourcePath)
      : decodeWaveformPeaksFromUrl(src)
  ).catch((error) => {
    waveformCache.delete(cacheKey);
    throw error;
  });
  waveformCache.set(cacheKey, pending);
  return pending;
}

export function sliceWaveformPeaks(
  peaks: number[],
  sourceOffsetMs: number,
  durationMs: number,
  barCount: number,
): number[] {
  if (barCount <= 0 || peaks.length === 0) {
    return Array.from({ length: Math.max(barCount, 1) }, () => MIN_BAR_HEIGHT);
  }

  const startIndex = Math.max(
    0,
    Math.floor((sourceOffsetMs / 1000) * PEAKS_PER_SECOND),
  );
  const endIndex = Math.min(
    peaks.length,
    Math.ceil(((sourceOffsetMs + durationMs) / 1000) * PEAKS_PER_SECOND),
  );
  const segment = peaks.slice(startIndex, endIndex);

  if (segment.length === 0) {
    return Array.from({ length: barCount }, () => MIN_BAR_HEIGHT);
  }

  const bars: number[] = [];
  for (let index = 0; index < barCount; index += 1) {
    const sliceStart = Math.floor((index / barCount) * segment.length);
    const sliceEnd = Math.max(
      sliceStart + 1,
      Math.floor(((index + 1) / barCount) * segment.length),
    );
    let peak = 0;
    for (let cursor = sliceStart; cursor < sliceEnd; cursor += 1) {
      peak = Math.max(peak, segment[cursor] ?? 0);
    }
    bars.push(peak);
  }

  const maxPeak = Math.max(...bars, 0.001);
  return bars.map((peak) =>
    Math.max(MIN_BAR_HEIGHT, Math.min(1, peak / maxPeak)),
  );
}

export function waveformBarCountForWidth(widthPx: number): number {
  return Math.max(12, Math.min(160, Math.floor(widthPx / 3)));
}
