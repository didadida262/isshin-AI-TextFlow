import { useCallback, useState } from "react";
import { useTranslationMessages } from "../contexts/I18nContext";
import { useScriptAgentChat } from "../hooks/useScriptAgentChat";
import {
  isEventExtractionComplete,
  type NovelChapterRecord,
} from "../services/novel";
import { SCRIPT_STATE_ERROR, type ScriptRecord, type ScriptWorkData } from "../services/script";
import type { AppConfig, CreationProject } from "../types";
import { ScriptAgentChatPanel } from "./ScriptAgentChatPanel";
import { ScriptWorkspacePanel } from "./ScriptWorkspacePanel";

interface AiScriptStepProps {
  project: CreationProject;
  title: string;
  config: AppConfig;
  selectedModel: string;
  chapters: NovelChapterRecord[];
  workData: ScriptWorkData;
  scripts: ScriptRecord[];
  onConfigError: (message: string | null) => void;
  onWorkflowChange?: () => void;
  onScriptsUpdated?: (scripts: ScriptRecord[], workData: ScriptWorkData) => void;
}

export function AiScriptStep({
  project,
  title,
  config,
  selectedModel,
  chapters,
  workData: initialWorkData,
  scripts: initialScripts,
  onConfigError,
  onWorkflowChange,
  onScriptsUpdated,
}: AiScriptStepProps) {
  const i18n = useTranslationMessages();
  const s = i18n.creation.aiScriptStep;
  const [workData, setWorkData] = useState(initialWorkData);
  const [scripts, setScripts] = useState(initialScripts);

  const eventsReady = isEventExtractionComplete(chapters);
  const hasFailedScripts = scripts.some(
    (item) => item.scriptState === SCRIPT_STATE_ERROR,
  );

  const handleComplete = useCallback(
    (result: { workData: ScriptWorkData; scripts: ScriptRecord[] }) => {
      setWorkData(result.workData);
      setScripts(result.scripts);
      onScriptsUpdated?.(result.scripts, result.workData);
      onWorkflowChange?.();
    },
    [onScriptsUpdated, onWorkflowChange],
  );

  const {
    messages,
    isGenerating,
    sendMessage,
    stopGeneration,
    retryFailed,
  } = useScriptAgentChat({
    project,
    config,
    model: selectedModel,
    chapters,
    workData,
    scripts,
    labels: {
      welcome: s.chatWelcome,
      welcomeHint: s.chatWelcomeHint,
      suggestGenerate: s.chatSuggestGenerate,
      suggestGeneratePrompt: s.chatSuggestGeneratePrompt,
      agentCoordinator: s.chatAgentCoordinator,
      agentWriter: s.chatAgentWriter,
      stageSkeleton: s.stageSkeleton,
      stageAdaptation: s.stageAdaptation,
      stageScriptsProgress: s.stageScriptsProgress,
      pipelineComplete: s.chatPipelineComplete,
      pipelineStopped: s.chatPipelineStopped,
      chatFallback: s.chatFallback,
      retryFailed: s.retryFailed,
      retryFailedProgress: s.retryFailedProgress,
      retryFailedComplete: s.chatRetryFailedComplete,
      retryFailedNone: s.chatRetryFailedNone,
      configRequired: i18n.errors.configRequired,
      modelsRequired: i18n.errors.modelsRequired,
      eventsRequired: s.prerequisiteHint,
    },
    onConfigError,
    onComplete: handleComplete,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="step-panel-title w-fit shrink-0 self-start">{title}</h2>

      {!eventsReady ? (
        <div className="mt-6 flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 bg-surface/20 px-6">
          <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
            {s.prerequisiteHint}
          </p>
        </div>
      ) : (
        <div className="mt-6 flex min-h-0 flex-1 gap-4 overflow-hidden">
          <div className="flex w-[32%] min-w-[280px] max-w-[420px] shrink-0 flex-col">
            <ScriptAgentChatPanel
              messages={messages}
              isGenerating={isGenerating}
              onSend={(text) => void sendMessage(text)}
              onStop={stopGeneration}
              onSuggestionClick={(item) => void sendMessage(item.prompt)}
            />
          </div>

          <ScriptWorkspacePanel
            workData={workData}
            scripts={scripts}
            hasFailedScripts={hasFailedScripts}
            isGenerating={isGenerating}
            onRetryFailed={() => void retryFailed()}
          />
        </div>
      )}
    </div>
  );
}
