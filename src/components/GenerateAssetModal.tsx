import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  generateImageB64,
} from "../services/imageGeneration";
import { PaintbrushLoading } from "./PaintbrushLoading";
import { ModalPortal } from "./ModalPortal";
import { Select } from "./Select";

export interface GenerateAssetFormValues {
  name: string;
  assetType: string;
  prompt: string;
  model: string;
  size: string;
}

interface GenerateAssetModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: GenerateAssetFormValues, imageB64: string) => Promise<void>;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const SIZE_OPTIONS = ["1024x1024", "768x768", "512x512"];

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50 disabled:opacity-50";

export function GenerateAssetModal({
  open,
  onClose,
  onSubmit,
}: GenerateAssetModalProps) {
  const m = useTranslationMessages().creation.generateAssetModal;
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("scene");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(DEFAULT_IMAGE_SIZE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setAssetType("scene");
    setPrompt("");
    setSize(DEFAULT_IMAGE_SIZE);
    setError("");
  }, [open]);

  const canSubmit = name.trim() && prompt.trim() && !submitting;

  const assetTypeOptions = useMemo(
    () => [
      { value: "character", label: m.typeCharacter },
      { value: "scene", label: m.typeScene },
      { value: "prop", label: m.typeProp },
    ],
    [m.typeCharacter, m.typeProp, m.typeScene],
  );

  const sizeOptions = useMemo(
    () => SIZE_OPTIONS.map((option) => ({ value: option, label: option })),
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const imageB64 = await generateImageB64({
        prompt,
        size,
      });
      await onSubmit(
        {
          name: name.trim(),
          assetType,
          prompt: prompt.trim(),
          model: DEFAULT_IMAGE_MODEL,
          size,
        },
        imageB64,
      );
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : String(submitError);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [assetType, canSubmit, name, onClose, onSubmit, prompt, size]);

  return (
    <ModalPortal>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="generate-asset-modal"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayExit}
        >
          <button
            type="button"
            aria-label={m.cancel}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={submitting ? undefined : onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-asset-title"
            className={`relative z-10 flex max-h-[min(520px,calc(100dvh-7rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-surface shadow-2xl ${
              submitting
                ? "modal-generating-border border-transparent"
                : "border-white/10"
            }`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={spring}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
              <h3 id="generate-asset-title" className="text-base font-semibold text-white">
                {m.title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{m.nameLabel}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={m.namePlaceholder}
                    disabled={submitting}
                    className={fieldClass}
                  />
                </label>

                <div className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{m.typeLabel}</span>
                  <Select
                    value={assetType}
                    options={assetTypeOptions}
                    onChange={setAssetType}
                    disabled={submitting}
                  />
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{m.promptLabel}</span>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={m.promptPlaceholder}
                    rows={3}
                    disabled={submitting}
                    className="max-h-[120px] w-full resize-none overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-accent/50 disabled:opacity-50"
                  />
                </label>

                <div className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{m.sizeLabel}</span>
                  <Select
                    value={size}
                    options={sizeOptions}
                    onChange={setSize}
                    disabled={submitting}
                  />
                </div>

                {error ? (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                {m.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? m.generating : m.confirm}
              </button>
            </div>

            {submitting ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-black/75 backdrop-blur-[2px]"
                aria-live="polite"
                aria-busy="true"
              >
                <PaintbrushLoading label={m.generating} />
              </div>
            ) : null}
          </motion.div>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
