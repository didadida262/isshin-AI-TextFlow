import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ProjectAssetRecord } from "../services/assets";
import type { ScriptRecord } from "../services/script";
import { ModalPortal } from "./ModalPortal";

interface VideoPromptEditModalProps {
  script: ScriptRecord | null;
  video?: ProjectAssetRecord | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (videoPrompt: string) => void | Promise<void>;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const textareaClass =
  "box-border w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 pb-7 text-sm leading-relaxed text-white outline-none transition focus:border-accent/50 min-h-[14rem]";

function resolveInitialPrompt(
  script: ScriptRecord,
  video?: ProjectAssetRecord | null,
): string {
  const draft = script.videoPrompt?.trim();
  if (draft) return draft;
  return video?.prompt?.trim() ?? "";
}

export function VideoPromptEditModal({
  script,
  video,
  saving = false,
  onClose,
  onSave,
}: VideoPromptEditModalProps) {
  const s = useTranslationMessages().creation.generateVideoStep;
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!script) return;
    setPrompt(resolveInitialPrompt(script, video));
  }, [script, video]);

  const canSave = Boolean(script && prompt.trim() && !saving);

  const handleSave = () => {
    if (!canSave) return;
    void onSave(prompt.trim());
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        {script ? (
          <motion.div
            key="video-prompt-edit-modal"
            className="fixed inset-0 z-[75] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={s.cancel}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="video-prompt-edit-title"
              className="relative z-10 flex max-h-[min(640px,calc(100dvh-3rem))] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/10 bg-surface shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="min-w-0 pr-3">
                  <h3
                    id="video-prompt-edit-title"
                    className="text-base font-semibold text-white"
                  >
                    {s.promptEditTitle}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {script.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{s.colPrompt}</span>
                  <div className="relative">
                    <textarea
                      value={prompt}
                      rows={12}
                      onChange={(event) => setPrompt(event.target.value)}
                      disabled={saving}
                      className={textareaClass}
                      placeholder={s.promptEditPlaceholder}
                    />
                    <span className="pointer-events-none absolute bottom-2 right-3 text-xs tabular-nums text-text-dim">
                      {prompt.length} {s.charsUnit}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-5 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {s.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                      {s.saving}
                    </>
                  ) : (
                    s.save
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
