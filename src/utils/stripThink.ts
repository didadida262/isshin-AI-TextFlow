const THINK_BLOCK =
  /<(?:think|redacted_thinking)>[\s\S]*?<\/(?:think|redacted_thinking)>/gi;
const THINK_OPEN = /<(?:think|redacted_thinking)>/i;

function trailingPipeLine(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.startsWith("|") && line.endsWith("|")) return line;
  }
  return "";
}

/** Remove reasoning blocks from deep-thinking model output. */
export function stripThink(text: string): string {
  let result = text.replace(THINK_BLOCK, "");

  if (THINK_OPEN.test(result)) {
    const preserved = trailingPipeLine(result);
    if (preserved) return preserved;

    result = result.replace(
      /^<(?:think|redacted_thinking)>[\s\S]*?<\/(?:think|redacted_thinking)>/i,
      "",
    );
  }
  if (THINK_OPEN.test(result)) {
    result = result.replace(/^<(?:think|redacted_thinking)>[\s\S]*/i, "");
  }

  return result.trim();
}
