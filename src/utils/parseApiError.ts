export function parseApiErrorMessage(
  responseText: string,
  status?: number,
): string {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return status ? `请求失败 (HTTP ${status})` : "请求失败";
  }

  try {
    const json = JSON.parse(trimmed) as {
      error?: { message?: string; type?: string };
      message?: string;
    };
    const message = json.error?.message ?? json.message;
    if (message) {
      if (status === 401 || json.error?.type === "unauthorized") {
        return `${message}。请打开左下角设置，检查 API Key 是否正确。`;
      }
      return message;
    }
  } catch {
    /* plain text response */
  }

  return trimmed;
}
