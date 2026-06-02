/** Remove reasoning blocks from deep-thinking model output. */
export function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/g, "")
    .trim();
}
