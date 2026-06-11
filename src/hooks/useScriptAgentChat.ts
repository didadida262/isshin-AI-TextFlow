import { useCallback, useEffect, useRef, useState } from "react";
import {
  regenerateFailedEpisodes,
  runScriptPipeline,
  streamCoordinatorChat,
} from "../agents/workflowAgent/scriptGeneration";
import { SCRIPT_STATE_ERROR, SCRIPT_STATE_SUCCESS } from "../services/script";
import type {
  ScriptChatMessage,
  ScriptGenerationProgress,
  ScriptPipelineStage,
} from "../agents/workflowAgent/scriptGeneration";
import {
  isEventExtractionComplete,
  type NovelChapterRecord,
} from "../services/novel";
import type { ScriptRecord, ScriptWorkData } from "../services/script";
import { buildPipelineErrorResponse } from "../utils/scriptPipelineError";
import { stripThink } from "../utils/stripThink";
import type { AppConfig, CreationProject } from "../types";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const scriptChatCache = new Map<string, ScriptChatMessage[]>();

function hasGeneratedScriptContent(
  workData: ScriptWorkData,
  scripts: ScriptRecord[],
): boolean {
  return (
    scripts.length > 0 ||
    workData.storySkeleton.trim().length > 0 ||
    workData.adaptationStrategy.trim().length > 0
  );
}

function buildWelcomeMessage(
  labels: Pick<
    UseScriptAgentChatOptions["labels"],
    | "welcome"
    | "welcomeHint"
    | "suggestGenerate"
    | "suggestGeneratePrompt"
    | "agentCoordinator"
  >,
  withSuggestion: boolean,
): ScriptChatMessage {
  return {
    id: createId(),
    role: "assistant",
    name: labels.agentCoordinator,
    content: `${labels.welcome}\n\n${labels.welcomeHint}`,
    status: "complete",
    suggestions: withSuggestion
      ? [
          {
            title: labels.suggestGenerate,
            prompt: labels.suggestGeneratePrompt,
          },
        ]
      : undefined,
  };
}

function buildInitialMessages(
  projectId: string,
  workData: ScriptWorkData,
  scripts: ScriptRecord[],
  labels: UseScriptAgentChatOptions["labels"],
): ScriptChatMessage[] {
  const cached = scriptChatCache.get(projectId);
  if (cached && cached.length > 0) {
    return cached;
  }

  if (!hasGeneratedScriptContent(workData, scripts)) {
    return [buildWelcomeMessage(labels, true)];
  }

  return [
    buildWelcomeMessage(labels, false),
    {
      id: createId(),
      role: "user",
      content: labels.suggestGeneratePrompt,
      status: "complete",
    },
    {
      id: createId(),
      role: "assistant",
      name: labels.agentWriter,
      content: labels.pipelineComplete,
      status: "complete",
    },
  ];
}

function progressToAgentMessage(
  progress: ScriptGenerationProgress,
  labels: {
    stageSkeleton: string;
    stageAdaptation: string;
    stageScriptsProgress: (completed: number, total: number) => string;
  },
): string {
  if (progress.stage === "skeleton") return labels.stageSkeleton;
  if (progress.stage === "adaptation") return labels.stageAdaptation;
  if (progress.completed != null && progress.total != null) {
    return labels.stageScriptsProgress(progress.completed, progress.total);
  }
  return labels.stageAdaptation;
}

function stageCompleteLabel(
  stage: ScriptPipelineStage,
  labels: {
    stageSkeletonComplete: string;
    stageAdaptationComplete: string;
    stageScriptsComplete: string;
  },
): string {
  if (stage === "skeleton") return labels.stageSkeletonComplete;
  if (stage === "adaptation") return labels.stageAdaptationComplete;
  return labels.stageScriptsComplete;
}

interface UseScriptAgentChatOptions {
  project: CreationProject;
  config: AppConfig;
  model: string;
  chapters: NovelChapterRecord[];
  workData: ScriptWorkData;
  scripts: ScriptRecord[];
  labels: {
    welcome: string;
    welcomeHint: string;
    suggestGenerate: string;
    suggestGeneratePrompt: string;
    agentCoordinator: string;
    agentWriter: string;
    stageSkeleton: string;
    stageAdaptation: string;
    stageSkeletonComplete: string;
    stageAdaptationComplete: string;
    stageScriptsComplete: string;
    stageScriptsProgress: (completed: number, total: number) => string;
    pipelineComplete: string;
    pipelineStopped: string;
    pipelineErrorTitle: string;
    pipelineErrorSkeletonBody: string;
    pipelineErrorAdaptationBody: string;
    pipelineErrorScriptsBody: string;
    pipelineErrorGenericBody: string;
    pipelineErrorTips: string;
    pipelineErrorDetailPrefix: string;
    chatFallback: string;
    retryFailed: string;
    retryFailedProgress: (completed: number, total: number) => string;
    retryFailedComplete: string;
    retryFailedNone: string;
    configRequired: string;
    modelsRequired: string;
    eventsRequired: string;
  };
  onConfigError: (message: string | null) => void;
  onPartialUpdate?: (result: {
    workData: ScriptWorkData;
    scripts: ScriptRecord[];
  }) => void;
  onComplete?: (result: {
    workData: ScriptWorkData;
    scripts: ScriptRecord[];
  }) => void;
}

export function useScriptAgentChat({
  project,
  config,
  model,
  chapters,
  workData,
  scripts,
  labels,
  onConfigError,
  onPartialUpdate,
  onComplete,
}: UseScriptAgentChatOptions) {
  const [messages, setMessages] = useState<ScriptChatMessage[]>(() =>
    buildInitialMessages(project.id, workData, scripts, labels),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] =
    useState<ScriptGenerationProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressMsgIdRef = useRef<string | null>(null);
  const completedStagesRef = useRef<Set<ScriptPipelineStage>>(new Set());

  useEffect(() => {
    scriptChatCache.set(project.id, messages);
  }, [messages, project.id]);

  const updateMessages = useCallback(
    (updater: (prev: ScriptChatMessage[]) => ScriptChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        scriptChatCache.set(project.id, next);
        return next;
      });
    },
    [project.id],
  );

  useEffect(() => {
    if (isGenerating) return;

    const expectedCount = chapters.length;
    if (expectedCount <= 0) return;

    const successCount = scripts.filter(
      (item) => item.scriptState === SCRIPT_STATE_SUCCESS,
    ).length;
    if (successCount < expectedCount) return;

    updateMessages((prev) => {
      let changed = false;
      const next = prev.map((message) => {
        if (
          message.role === "assistant" &&
          message.name === labels.agentWriter &&
          message.status === "streaming"
        ) {
          changed = true;
          return {
            ...message,
            content: labels.pipelineComplete,
            status: "complete" as const,
          };
        }
        return message;
      });
      return changed ? next : prev;
    });
  }, [
    chapters.length,
    isGenerating,
    labels.agentWriter,
    labels.pipelineComplete,
    scripts,
    updateMessages,
  ]);

  const patchMessage = useCallback(
    (id: string, patch: Partial<ScriptChatMessage>) => {
      updateMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      );
    },
    [updateMessages],
  );

  const appendMessage = useCallback(
    (message: ScriptChatMessage) => {
      updateMessages((prev) => [...prev, message]);
      return message.id;
    },
    [updateMessages],
  );

  const shouldStartPipeline = useCallback((text: string) => {
    const normalized = text.trim();
    return (
      normalized === labels.suggestGeneratePrompt ||
      /生成|开始|启动/.test(normalized)
    );
  }, [labels.suggestGeneratePrompt]);

  const runPipeline = useCallback(async () => {
    if (!config.baseUrl.trim() || !config.apiKey.trim()) {
      onConfigError(labels.configRequired);
      return;
    }
    if (!model.trim()) {
      onConfigError(labels.modelsRequired);
      return;
    }
    if (!isEventExtractionComplete(chapters)) {
      onConfigError(labels.eventsRequired);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setGenerationProgress({ stage: "skeleton" });
    onConfigError(null);
    completedStagesRef.current = new Set();

    const markStageComplete = (
      stage: ScriptPipelineStage,
      nextProgress: ScriptGenerationProgress | null,
    ) => {
      const currentId = progressMsgIdRef.current;
      if (!currentId) return;

      patchMessage(currentId, {
        content: stageCompleteLabel(stage, labels),
        status: "complete",
        milestone: stage,
      });

      if (!nextProgress) {
        progressMsgIdRef.current = null;
        return;
      }

      const nextId = createId();
      appendMessage({
        id: nextId,
        role: "assistant",
        name: labels.agentWriter,
        content: progressToAgentMessage(nextProgress, labels),
        status: "streaming",
      });
      progressMsgIdRef.current = nextId;
    };

    const progressId = appendMessage({
      id: createId(),
      role: "assistant",
      name: labels.agentWriter,
      content: labels.stageSkeleton,
      status: "streaming",
    });
    progressMsgIdRef.current = progressId;

    try {
      const result = await runScriptPipeline({
        project,
        config,
        model,
        chapters,
        initialWorkData: workData,
        initialScripts: scripts,
        signal: controller.signal,
        onProgress: (progress) => {
          setGenerationProgress(progress);
          const activeId = progressMsgIdRef.current;
          if (!activeId) return;
          patchMessage(activeId, {
            content: progressToAgentMessage(progress, labels),
            status: "streaming",
          });
        },
        onStageComplete: (partial) => {
          onPartialUpdate?.(partial);
          const wd = partial.workData;

          if (
            wd.storySkeleton.trim() &&
            !completedStagesRef.current.has("skeleton")
          ) {
            completedStagesRef.current.add("skeleton");
            markStageComplete("skeleton", { stage: "adaptation" });
          } else if (
            wd.adaptationStrategy.trim() &&
            !completedStagesRef.current.has("adaptation")
          ) {
            completedStagesRef.current.add("adaptation");
            markStageComplete("adaptation", {
              stage: "scripts",
              completed: 0,
              total: chapters.length,
            });
          }
        },
      });

      if (!completedStagesRef.current.has("scripts")) {
        completedStagesRef.current.add("scripts");
        markStageComplete("scripts", null);
      }

      appendMessage({
        id: createId(),
        role: "assistant",
        name: labels.agentWriter,
        content: labels.pipelineComplete,
        status: "complete",
      });
      onComplete?.(result);
    } catch (error) {
      const activeProgressId = progressMsgIdRef.current;
      if (error instanceof DOMException && error.name === "AbortError") {
        if (activeProgressId) {
          patchMessage(activeProgressId, {
            content: labels.pipelineStopped,
            status: "stop",
          });
        }
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const errorResponse = buildPipelineErrorResponse(message, {
        errorTitle: labels.pipelineErrorTitle,
        errorSkeletonBody: labels.pipelineErrorSkeletonBody,
        errorAdaptationBody: labels.pipelineErrorAdaptationBody,
        errorScriptsBody: labels.pipelineErrorScriptsBody,
        errorGenericBody: labels.pipelineErrorGenericBody,
        errorTips: labels.pipelineErrorTips,
        errorDetailPrefix: labels.pipelineErrorDetailPrefix,
        suggestRetry: labels.suggestGenerate,
        suggestGeneratePrompt: labels.suggestGeneratePrompt,
      });
      if (activeProgressId) {
        patchMessage(activeProgressId, {
          content: errorResponse.content,
          status: "error",
          suggestions: errorResponse.suggestions,
        });
      }
      onConfigError(message);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
      progressMsgIdRef.current = null;
      abortRef.current = null;
    }
  }, [
    appendMessage,
    chapters,
    config,
    labels,
    model,
    onComplete,
    onConfigError,
    onPartialUpdate,
    patchMessage,
    project,
    scripts,
    workData,
  ]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      appendMessage({
        id: createId(),
        role: "user",
        content: trimmed,
        status: "complete",
      });

      if (shouldStartPipeline(trimmed)) {
        await runPipeline();
        return;
      }

      if (!config.baseUrl.trim() || !config.apiKey.trim()) {
        onConfigError(labels.configRequired);
        return;
      }
      if (!model.trim()) {
        onConfigError(labels.modelsRequired);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);
      setGenerationProgress(null);
      onConfigError(null);

      const assistantId = appendMessage({
        id: createId(),
        role: "assistant",
        name: labels.agentCoordinator,
        content: "",
        status: "streaming",
      });

      const history = [
        ...messages
          .filter(
            (message) =>
              message.content.trim() &&
              (message.role === "user" || message.role === "assistant") &&
              message.status !== "streaming",
          )
          .map((message) => ({
            role: message.role,
            content: message.content.trim(),
          })),
        { role: "user" as const, content: trimmed },
      ];

      try {
        let full = "";
        for await (const chunk of streamCoordinatorChat({
          project,
          config,
          model,
          chapters,
          workData,
          scripts,
          history,
          signal: controller.signal,
        })) {
          full += chunk;
          patchMessage(assistantId, {
            content: stripThink(full),
            status: "streaming",
          });
        }

        const content = stripThink(full).trim() || labels.chatFallback;
        patchMessage(assistantId, {
          content,
          status: "complete",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          patchMessage(assistantId, {
            content: labels.pipelineStopped,
            status: "stop",
          });
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        const errorResponse = buildPipelineErrorResponse(
          message || labels.chatFallback,
          {
            errorTitle: labels.pipelineErrorTitle,
            errorSkeletonBody: labels.pipelineErrorSkeletonBody,
            errorAdaptationBody: labels.pipelineErrorAdaptationBody,
            errorScriptsBody: labels.pipelineErrorScriptsBody,
            errorGenericBody: labels.pipelineErrorGenericBody,
            errorTips: labels.pipelineErrorTips,
            errorDetailPrefix: labels.pipelineErrorDetailPrefix,
            suggestRetry: labels.suggestGenerate,
            suggestGeneratePrompt: labels.suggestGeneratePrompt,
          },
        );
        patchMessage(assistantId, {
          content: errorResponse.content,
          status: "error",
          suggestions: errorResponse.suggestions,
        });
        onConfigError(message);
      } finally {
        setIsGenerating(false);
        setGenerationProgress(null);
        abortRef.current = null;
      }
    },
    [
      appendMessage,
      chapters,
      config,
      isGenerating,
      labels.agentCoordinator,
      labels.chatFallback,
      labels.pipelineErrorAdaptationBody,
      labels.pipelineErrorDetailPrefix,
      labels.pipelineErrorGenericBody,
      labels.pipelineErrorScriptsBody,
      labels.pipelineErrorSkeletonBody,
      labels.pipelineErrorTips,
      labels.pipelineErrorTitle,
      labels.suggestGenerate,
      labels.suggestGeneratePrompt,
      labels.configRequired,
      labels.modelsRequired,
      labels.pipelineStopped,
      labels.suggestGenerate,
      labels.suggestGeneratePrompt,
      messages,
      model,
      onConfigError,
      patchMessage,
      project,
      runPipeline,
      scripts,
      shouldStartPipeline,
      workData,
    ],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryFailed = useCallback(async () => {
    if (isGenerating) return;

    const failedCount = scripts.filter(
      (item) => item.scriptState === SCRIPT_STATE_ERROR,
    ).length;
    if (failedCount === 0) {
      appendMessage({
        id: createId(),
        role: "assistant",
        name: labels.agentCoordinator,
        content: labels.retryFailedNone,
        status: "complete",
      });
      return;
    }

    if (!config.baseUrl.trim() || !config.apiKey.trim()) {
      onConfigError(labels.configRequired);
      return;
    }
    if (!model.trim()) {
      onConfigError(labels.modelsRequired);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setGenerationProgress({
      stage: "scripts",
      completed: 0,
      total: failedCount,
    });
    onConfigError(null);

    const progressId = appendMessage({
      id: createId(),
      role: "assistant",
      name: labels.agentWriter,
      content: labels.retryFailed,
      status: "streaming",
    });

    try {
      const result = await regenerateFailedEpisodes({
        project,
        config,
        model,
        chapters,
        workData,
        scripts,
        signal: controller.signal,
        onProgress: (progress) => {
          setGenerationProgress(progress);
          if (progress.completed != null && progress.total != null) {
            patchMessage(progressId, {
              content: labels.retryFailedProgress(
                progress.completed,
                progress.total,
              ),
              status: "streaming",
            });
          }
        },
        onStageComplete: (partial) => {
          onPartialUpdate?.(partial);
        },
      });

      patchMessage(progressId, {
        content: labels.retryFailedComplete,
        status: "complete",
      });
      onComplete?.(result);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        patchMessage(progressId, {
          content: labels.pipelineStopped,
          status: "stop",
        });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const errorResponse = buildPipelineErrorResponse(message, {
        errorTitle: labels.pipelineErrorTitle,
        errorSkeletonBody: labels.pipelineErrorSkeletonBody,
        errorAdaptationBody: labels.pipelineErrorAdaptationBody,
        errorScriptsBody: labels.pipelineErrorScriptsBody,
        errorGenericBody: labels.pipelineErrorGenericBody,
        errorTips: labels.pipelineErrorTips,
        errorDetailPrefix: labels.pipelineErrorDetailPrefix,
        suggestRetry: labels.suggestGenerate,
        suggestGeneratePrompt: labels.suggestGeneratePrompt,
      });
      patchMessage(progressId, {
        content: errorResponse.content,
        status: "error",
        suggestions: errorResponse.suggestions,
      });
      onConfigError(message);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
      abortRef.current = null;
    }
  }, [
    appendMessage,
    chapters,
    config,
    isGenerating,
    labels,
    model,
    onComplete,
    onConfigError,
    onPartialUpdate,
    patchMessage,
    project,
    scripts,
    workData,
  ]);

  return {
    messages,
    isGenerating,
    generationProgress,
    sendMessage,
    stopGeneration,
    runPipeline,
    retryFailed,
  };
}
