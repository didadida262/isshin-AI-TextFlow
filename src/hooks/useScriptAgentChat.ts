import { useCallback, useEffect, useRef, useState } from "react";
import { streamCoordinatorChat } from "../agents/scriptAgent/coordinatorChatAgent";
import { runScriptPipeline, regenerateFailedEpisodes } from "../agents/scriptAgent/orchestrator";
import { SCRIPT_STATE_ERROR } from "../services/script";
import type { ScriptGenerationProgress } from "../agents/scriptAgent/types";
import type { ScriptChatMessage } from "../agents/scriptAgent/chatTypes";
import {
  isEventExtractionComplete,
  type NovelChapterRecord,
} from "../services/novel";
import type { ScriptRecord, ScriptWorkData } from "../services/script";
import { stripThink } from "../utils/stripThink";
import type { AppConfig, CreationProject } from "../types";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
    stageScriptsProgress: (completed: number, total: number) => string;
    pipelineComplete: string;
    pipelineStopped: string;
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
  onComplete,
}: UseScriptAgentChatOptions) {
  const [messages, setMessages] = useState<ScriptChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const progressMsgIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setMessages([
      {
        id: createId(),
        role: "assistant",
        name: labels.agentCoordinator,
        content: `${labels.welcome}\n\n${labels.welcomeHint}`,
        status: "complete",
        suggestions: [
          {
            title: labels.suggestGenerate,
            prompt: labels.suggestGeneratePrompt,
          },
        ],
      },
    ]);
  }, [
    labels.agentCoordinator,
    labels.suggestGenerate,
    labels.suggestGeneratePrompt,
    labels.welcome,
    labels.welcomeHint,
  ]);

  const patchMessage = useCallback(
    (id: string, patch: Partial<ScriptChatMessage>) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      );
    },
    [],
  );

  const appendMessage = useCallback((message: ScriptChatMessage) => {
    setMessages((prev) => [...prev, message]);
    return message.id;
  }, []);

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
    onConfigError(null);

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
          patchMessage(progressId, {
            content: progressToAgentMessage(progress, labels),
            status: "streaming",
          });
        },
      });

      patchMessage(progressId, {
        content: labels.pipelineComplete,
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
      patchMessage(progressId, {
        content: message,
        status: "error",
      });
      onConfigError(message);
    } finally {
      setIsGenerating(false);
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
        patchMessage(assistantId, {
          content: message || labels.chatFallback,
          status: "error",
        });
        onConfigError(message);
      } finally {
        setIsGenerating(false);
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
      patchMessage(progressId, {
        content: message,
        status: "error",
      });
      onConfigError(message);
    } finally {
      setIsGenerating(false);
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
    patchMessage,
    project,
    scripts,
    workData,
  ]);

  return {
    messages,
    isGenerating,
    sendMessage,
    stopGeneration,
    runPipeline,
    retryFailed,
  };
}
