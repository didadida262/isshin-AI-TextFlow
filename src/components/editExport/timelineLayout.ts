export const PIXELS_PER_SECOND = 40;

export function msToWidth(ms: number): number {
  return (ms / 1000) * PIXELS_PER_SECOND;
}

export function widthToMs(width: number): number {
  return (width / PIXELS_PER_SECOND) * 1000;
}
