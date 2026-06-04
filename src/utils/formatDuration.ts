export function formatDurationMs(ms: number, locale: "zh" | "en"): string {
  const safeMs = Math.max(0, Math.round(ms));
  if (safeMs < 1000) {
    return locale === "zh" ? `${safeMs} 毫秒` : `${safeMs} ms`;
  }
  if (safeMs < 60_000) {
    const seconds = (safeMs / 1000).toFixed(1);
    return locale === "zh" ? `${seconds} 秒` : `${seconds} s`;
  }
  const minutes = Math.floor(safeMs / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  return locale === "zh"
    ? `${minutes} 分 ${seconds} 秒`
    : `${minutes}m ${seconds}s`;
}
