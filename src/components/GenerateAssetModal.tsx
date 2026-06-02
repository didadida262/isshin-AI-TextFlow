import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import { DEFAULT_IMAGE_SIZE } from "../services/config";
import { generateImageB64 } from "../services/imageGeneration";
import type { AppConfig } from "../types";
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
  config: AppConfig;
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
  config,
  onClose,
  onSubmit,
}: GenerateAssetModalProps) {
  const m = useTranslationMessages().creation.generateAssetModal;
  const errors = useTranslationMessages().errors;
  const defaultSize = config.imageDefaultSize.trim() || DEFAULT_IMAGE_SIZE;
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("scene");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(defaultSize);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    abortRef.current = false;
    requestIdRef.current += 1;
    setName("");
    setAssetType("scene");
    setPrompt("");
    setSize(defaultSize);
    setError("");
  }, [defaultSize, open]);

  const canSubmit = name.trim() && prompt.trim() && !submitting;

  const assetTypeOptions = useMemo(
    () => [
      { value: "character", label: m.typeCharacter },
      { value: "scene", label: m.typeScene },
      { value: "prop", label: m.typeProp },
    ],
    [m.typeCharacter, m.typeProp, m.typeScene],
  );

  const sizeOptions = useMemo(() => {
    const options = new Set([defaultSize, ...SIZE_OPTIONS]);
    return [...options].map((option) => ({ value: option, label: option }));
  }, [defaultSize]);

  const imageSettings = useMemo(
    () => ({
      imageApiUrl: config.imageApiUrl,
      imageApiKey: config.imageApiKey,
      imageModel: config.imageModel,
      imageDefaultSize: defaultSize,
      imageCount: config.imageCount,
    }),
    [config, defaultSize],
  );

  const handleClose = useCallback(() => {
    if (submitting) {
      abortRef.current = true;
      requestIdRef.current += 1;
      setSubmitting(false);
    }
    onClose();
  }, [onClose, submitting]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const requestId = ++requestIdRef.current;
    abortRef.current = false;
    setSubmitting(true);
    setError("");
    try {
      const imageB64 = await generateImageB64({
        prompt,
        size,
        settings: imageSettings,
      });
      if (abortRef.current || requestId !== requestIdRef.current) return;

      await onSubmit(
        {
          name: name.trim(),
          assetType,
          prompt: prompt.trim(),
          model: config.imageModel,
          size,
        },
        imageB64,
      );
      if (abortRef.current || requestId !== requestIdRef.current) return;
      onClose();
    } catch (submitError) {
      if (abortRef.current || requestId !== requestIdRef.current) return;
      const message =
        submitError instanceof Error ? submitError.message : String(submitError);
      setError(
        message === "IMAGE_CONFIG_REQUIRED"
          ? errors.imageConfigRequired
          : message,
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setSubmitting(false);
      }
    }
  }, [
    assetType,
    canSubmit,
    config.imageModel,
    errors.imageConfigRequired,
    imageSettings,
    name,
    onClose,
    onSubmit,
    prompt,
    size,
  ]);

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
            onClick={submitting ? undefined : handleClose}
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
            <div className="relative z-30 flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
              <h3 id="generate-asset-title" className="text-base font-semibold text-white">
                {m.title}
              </h3>
              {!submitting ? (
                <button
                  type="button"
                  onClick={handleClose}
                  title={m.cancel}
                  aria-label={m.cancel}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {!submitting ? (
                  <>
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
                  </>
                ) : (
                  <div
                    className="flex min-h-[280px] items-center justify-center rounded-lg border border-white/10 bg-black/30 p-6"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <PaintbrushLoading label={m.generating} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-5 py-3.5">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white"
              >
                {submitting ? m.abortGenerating : m.cancel}
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
          </motion.div>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
