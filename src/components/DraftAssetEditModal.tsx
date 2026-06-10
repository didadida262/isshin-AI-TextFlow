import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { DraftAssetItem } from "../services/assetExtraction";
import { AssetTypeTag } from "./AssetTypeTag";
import { ModalPortal } from "./ModalPortal";

interface DraftAssetEditModalProps {
  item: DraftAssetItem | null;
  onClose: () => void;
  onSave: (id: string, name: string, prompt: string) => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50";

const textareaClass =
  "box-border w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 pb-7 text-sm leading-relaxed text-white outline-none transition focus:border-accent/50 min-h-[12rem]";

export function DraftAssetEditModal({
  item,
  onClose,
  onSave,
}: DraftAssetEditModalProps) {
  const s = useTranslationMessages().creation.generateAssetsStep;
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setPrompt(item.prompt);
  }, [item]);

  const canSave = Boolean(item && name.trim() && prompt.trim());

  const handleSave = () => {
    if (!item || !canSave) return;
    onSave(item.id, name.trim(), prompt.trim());
    onClose();
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        {item ? (
          <motion.div
            key="draft-asset-edit-modal"
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
              aria-labelledby="draft-asset-edit-title"
              className="relative z-10 flex max-h-[min(640px,calc(100dvh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-surface shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <h3
                  id="draft-asset-edit-title"
                  className="text-base font-semibold text-white"
                >
                  {s.draftEditTitle}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{s.colType}</span>
                  <div>
                    <AssetTypeTag
                      assetType={item.assetType}
                      labels={{
                        typeCharacter: s.typeCharacter,
                        typeScene: s.typeScene,
                        typeProp: s.typeProp,
                        typeVideo: s.typeVideo,
                      }}
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{s.colName}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={fieldClass}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{s.colPrompt}</span>
                  <div className="relative">
                    <textarea
                      value={prompt}
                      rows={9}
                      onChange={(event) => setPrompt(event.target.value)}
                      className={textareaClass}
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
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  {s.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {s.save}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
