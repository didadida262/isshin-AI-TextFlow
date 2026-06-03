import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig, ChatMessage, ChatMode, ChatSession } from "../types";
import { useI18n } from "../contexts/I18nContext";
import { getDefaultConfig, loadConfig, saveConfig } from "../services/config";
import { streamSessionChat, runToolLoop } from "../agents/sessionAssistant/textflowChatAgent";
import { streamChatCompletion } from "../services/chat";

function uid() {
  return crypto.randomUUID();
}

function createSession(title: string): ChatSession {
  return { id: uid(), title, messages: [], createdAt: Date.now() };
}

export function useAppState() {
  const { t } = useI18n();
  const [config, setConfig] = useState<AppConfig>(getDefaultConfig);
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    createSession(t("session.newSession")),
  ]);
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id);
  const [selectedModel, setSelectedModel] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolAgentRunning, setToolAgentRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("chat");
  const abortRef = useRef<AbortController | null>(null);
  const cancelRef = useRef(false);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  useEffect(() => {
    loadConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg.models.length > 0) setSelectedModel(cfg.models[0]);
    });
  }, []);

  const updateSession = useCallback(
    (sessionId: string, updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updater(s) : s)),
      );
    },
    [],
  );

  const appendMessage = useCallback(
    (sessionId: string, msg: ChatMessage) => {
      updateSession(sessionId, (s) => ({
        ...s,
        messages: [...s.messages, msg],
      }));
    },
    [updateSession],
  );

  const patchMessage = useCallback(
    (
      sessionId: string,
      messageId: string,
      patch: Partial<ChatMessage>,
    ) => {
      updateSession(sessionId, (s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === messageId ? { ...m, ...patch } : m,
        ),
      }));
    },
    [updateSession],
  );

  const handleSaveConfig = useCallback(async (next: AppConfig) => {
    setConfig(next);
    await saveConfig(next);
    if (next.models.length > 0 && !next.models.includes(selectedModel)) {
      setSelectedModel(next.models[0]);
    }
  }, [selectedModel]);

  const stopGeneration = useCallback(() => {
    cancelRef.current = true;
    abortRef.current?.abort();
    setIsLoading(false);
    setToolAgentRunning(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!config.baseUrl.trim() || !config.apiKey.trim()) {
        setConfigError(t("errors.configRequired"));
        setSettingsOpen(true);
        return;
      }
      if (!selectedModel) {
        setConfigError(t("errors.modelsRequired"));
        setSettingsOpen(true);
        return;
      }
      setConfigError(null);
      cancelRef.current = false;
      abortRef.current = null;

      const sessionId = activeSessionId;
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
      };

      updateSession(sessionId, (s) => {
        const title =
          s.messages.length === 0 ? text.slice(0, 24) : s.title;
        return {
          ...s,
          title,
          messages: [...s.messages, userMsg],
        };
      });

      setIsLoading(true);

      let agentObservation: string | null = null;

      if (chatMode === "assistant") {
        setToolAgentRunning(true);
        const toolStatusId = uid();
        appendMessage(sessionId, {
          id: toolStatusId,
          role: "tool-status",
          content: t("toolAgent.analyzing"),
          toolPhase: "thought",
        });

        try {
          const agentResult = await runToolLoop(text, (phase, detail) => {
            const labels: Record<string, string> = {
              thought: detail ?? t("toolAgent.recognizing"),
              action: t("toolAgent.querying", {
                count: detail ?? "…",
              }),
              observation: t("toolAgent.organizing"),
              done: t("toolAgent.done"),
              idle: t("toolAgent.idle"),
            };
            patchMessage(sessionId, toolStatusId, {
              toolPhase:
                phase === "done"
                  ? "done"
                  : phase === "observation"
                    ? "observation"
                    : phase === "action"
                      ? "action"
                      : "thought",
              content: labels[phase] ?? phase,
            });
          });

          agentObservation = agentResult.observation;

          if (agentResult.shouldAct || agentObservation) {
            patchMessage(sessionId, toolStatusId, {
              toolPhase: "done",
              content: agentResult.thought ?? t("toolAgent.done"),
            });
          } else {
            updateSession(sessionId, (s) => ({
              ...s,
              messages: s.messages.filter((m) => m.id !== toolStatusId),
            }));
          }
        } finally {
          setToolAgentRunning(false);
        }
      }

      if (cancelRef.current) {
        setIsLoading(false);
        return;
      }

      const assistantId = uid();
      appendMessage(sessionId, {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      });

      const history = [
        ...activeSession.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        { role: "user" as const, content: text },
      ];

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        let full = "";
        const replyStream =
          chatMode === "assistant"
            ? streamSessionChat({
                config,
                model: selectedModel,
                history,
                agentObservation,
                signal: controller.signal,
              })
            : streamChatCompletion(
                config,
                selectedModel,
                history,
                controller.signal,
              );

        for await (const chunk of replyStream) {
          if (cancelRef.current) break;
          full += chunk;
          patchMessage(sessionId, assistantId, { content: full.trimStart() });
        }

        const wasCancelled =
          cancelRef.current ||
          controller.signal.aborted;

        if (wasCancelled && !full.trim()) {
          updateSession(sessionId, (s) => ({
            ...s,
            messages: s.messages.filter((m) => m.id !== assistantId),
          }));
        } else {
          patchMessage(sessionId, assistantId, {
            content: full.trimStart(),
            isStreaming: false,
          });
        }
      } catch (e) {
        if (cancelRef.current || (e instanceof Error && e.name === "AbortError")) {
          updateSession(sessionId, (s) => {
            const msg = s.messages.find((m) => m.id === assistantId);
            if (!msg?.content.trim()) {
              return {
                ...s,
                messages: s.messages.filter((m) => m.id !== assistantId),
              };
            }
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m,
              ),
            };
          });
        } else {
          const err = e instanceof Error ? e.message : String(e);
          patchMessage(sessionId, assistantId, {
            content: t("errors.requestFailed", { error: err }),
            isStreaming: false,
          });
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [
      config,
      selectedModel,
      activeSessionId,
      activeSession.messages,
      chatMode,
      appendMessage,
      patchMessage,
      updateSession,
      t,
    ],
  );

  const newSession = useCallback(() => {
    const s = createSession(t("session.newSession"));
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
  }, [t]);

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        const sessions =
          next.length > 0 ? next : [createSession(t("session.newSession"))];

      setActiveSessionId((activeId) => {
        const stillExists = sessions.some((s) => s.id === activeId);
        if (activeId === sessionId || !stillExists) return sessions[0].id;
        return activeId;
      });

      return sessions;
    });
  },
    [t],
  );

  return {
    config,
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    selectedModel,
    setSelectedModel,
    settingsOpen,
    setSettingsOpen,
    toolAgentRunning,
    isLoading,
    configError,
    setConfigError,
    handleSaveConfig,
    sendMessage,
    stopGeneration,
    newSession,
    deleteSession,
    chatMode,
    setChatMode,
  };
}
