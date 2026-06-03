import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faPaperPlane,
  faStop,
} from "@fortawesome/free-solid-svg-icons";
import type {
  ScriptChatMessage,
  ScriptChatSuggestion,
} from "../agents/workflowAgent/chatTypes";
import ChatGptLogo from "../assets/ChatGptLogo";
import { MarkdownContent } from "./MarkdownContent";

interface ScriptAgentChatPanelProps {
  messages: ScriptChatMessage[];
  isGenerating: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onSuggestionClick: (suggestion: ScriptChatSuggestion) => void;
}

function ScriptChatBubble({ message }: { message: ScriptChatMessage }) {
  const isUser = message.role === "user";
  const [thinkingOpen, setThinkingOpen] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-lg bg-surface-elevated px-3.5 py-2.5 text-sm leading-relaxed text-white whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#10A37F] text-white">
        <ChatGptLogo className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        {message.name ? (
          <p className="mb-1 text-[11px] font-medium text-text-muted">
            {message.name}
          </p>
        ) : null}
        <div className="rounded-lg border border-white/10 bg-surface/80 px-3.5 py-2.5 text-sm leading-relaxed text-white/90">
          {message.thinking ? (
            <div className="mb-2 rounded-lg border border-white/10 bg-black/20">
              <button
                type="button"
                onClick={() => setThinkingOpen((open) => !open)}
                className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[11px] text-text-muted"
              >
                <FontAwesomeIcon
                  icon={thinkingOpen ? faChevronDown : faChevronRight}
                  className="text-[9px]"
                />
                {message.thinking.title}
              </button>
              {thinkingOpen ? (
                <pre className="max-h-32 overflow-auto border-t border-white/5 px-2.5 py-2 text-[11px] leading-relaxed whitespace-pre-wrap text-text-dim">
                  {message.thinking.text}
                </pre>
              ) : null}
            </div>
          ) : null}
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : null}
          {message.status === "streaming" ? (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ScriptAgentChatPanel({
  messages,
  isGenerating,
  disabled = false,
  onSend,
  onStop,
  onSuggestionClick,
}: ScriptAgentChatPanelProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating || disabled) return;
    onSend(trimmed);
    setText("");
    textareaRef.current?.focus();
  }, [disabled, isGenerating, onSend, text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-surface/30">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            onClick={(event) => {
              if (message.role !== "assistant" || !message.suggestions?.length) {
                return;
              }
              const target = event.target as HTMLElement;
              const chip = target.closest("[data-suggestion-prompt]");
              if (!chip) return;
              const prompt = chip.getAttribute("data-suggestion-prompt");
              const suggestion = message.suggestions?.find(
                (item) => item.prompt === prompt,
              );
              if (suggestion) onSuggestionClick(suggestion);
            }}
          >
            {message.suggestions?.length ? (
              <div className="space-y-2">
                <ScriptChatBubble
                  message={{
                    ...message,
                    suggestions: undefined,
                  }}
                />
                <div className="ml-9 flex flex-wrap gap-2">
                  {message.suggestions.map((item) => (
                    <button
                      key={item.prompt}
                      type="button"
                      data-suggestion-prompt={item.prompt}
                      disabled={isGenerating || disabled}
                      className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] text-accent transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ScriptChatBubble message={message} />
            )}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/10 p-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-surface px-1 py-0.5 focus-within:border-accent/50">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="max-h-24 min-h-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-5 text-white outline-none disabled:opacity-50"
          />
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-400 transition hover:bg-red-500/25"
              aria-label="Stop"
            >
              <FontAwesomeIcon icon={faStop} className="text-[10px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={disabled || !text.trim()}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <FontAwesomeIcon icon={faPaperPlane} className="text-[10px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
