import type { ScriptChatSuggestion } from "../agents/workflowAgent/scriptGeneration";

export interface ScriptPipelineErrorLabels {
  errorTitle: string;
  errorSkeletonBody: string;
  errorAdaptationBody: string;
  errorScriptsBody: string;
  errorGenericBody: string;
  errorTips: string;
  errorDetailPrefix: string;
  suggestRetry: string;
  suggestGeneratePrompt: string;
}

function detectPipelineStage(
  rawError: string,
): "skeleton" | "adaptation" | "scripts" | "generic" {
  if (/故事骨架/.test(rawError)) return "skeleton";
  if (/改编策略/.test(rawError)) return "adaptation";
  if (/剧本|逐集|集数/.test(rawError)) return "scripts";
  return "generic";
}

export function buildPipelineErrorResponse(
  rawError: string,
  labels: ScriptPipelineErrorLabels,
): { content: string; suggestions: ScriptChatSuggestion[] } {
  const stage = detectPipelineStage(rawError);
  const stageBody =
    stage === "skeleton"
      ? labels.errorSkeletonBody
      : stage === "adaptation"
        ? labels.errorAdaptationBody
        : stage === "scripts"
          ? labels.errorScriptsBody
          : labels.errorGenericBody;

  const detail = rawError.trim();
  const content = [
    `**${labels.errorTitle}**`,
    "",
    stageBody,
    "",
    labels.errorTips,
    detail ? `\n\n_${labels.errorDetailPrefix}${detail}_` : "",
  ]
    .join("\n")
    .trim();

  return {
    content,
    suggestions: [
      {
        title: labels.suggestRetry,
        prompt: labels.suggestGeneratePrompt,
      },
    ],
  };
}
