import { useState, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faStop } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ChatMode } from "../types";
import { ModeToggle } from "./ModeToggle";
import { ModelSelector } from "./ModelSelector";

interface SmartInputProps {
  isGenerating?: boolean;
  models: string[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
  onSend: (text: string) => void;
  onStop?: () => void;
}

export function SmartInput({
  isGenerating,
  models,
  selectedModel,
  onSelectModel,
  chatMode,
  onChatModeChange,
  onSend,
  onStop,
}: SmartInputProps) {
  const i18n = useTranslationMessages();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setText("");
    ref.current?.focus();
  }, [text, isGenerating, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const placeholder =
    chatMode === "assistant"
      ? i18n.input.placeholderAssistant
      : i18n.input.placeholderChat;

  return (
    <div className="border-t border-white/5 bg-[#0a0a0a] px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <ModeToggle
          mode={chatMode}
          onChange={onChatModeChange}
          disabled={isGenerating}
        />
        <ModelSelector
          models={models}
          selected={selectedModel}
          onSelect={onSelectModel}
        />
      </div>
      <div className="relative rounded-2xl border border-white/[0.08] bg-surface p-1 transition-[border-color,box-shadow] duration-200 focus-within:border-accent/60 focus-within:shadow-[0_0_20px_rgba(0,255,102,0.15)]">
        <textarea
          ref={ref}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm text-white outline-none placeholder:text-text-dim"
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={onStop}
            title={i18n.input.stop}
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90"
          >
            <FontAwesomeIcon icon={faStop} className="text-[10px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            title={i18n.input.send}
            className="absolute bottom-3 right-3 rounded-lg p-2 text-accent transition hover:bg-accent/10 disabled:opacity-30"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        )}
      </div>
    </div>
  );
}
