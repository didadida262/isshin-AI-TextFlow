/** Remove reasoning blocks from deep-thinking model output. */
export function stripThink(text: string): string {
  let result = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, "")
    .replace(/[\s\S]*?<\/think>/gi, "");

  if (/^<think>/i.test(result)) {
    result = result.replace(/^<think>[\s\S]*/i, "");
  }

  return result.trim();
}
