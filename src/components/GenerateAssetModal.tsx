import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_NUM_INFERENCE_STEPS,
} from "../services/config";
import { getPromptRefineSettingsFromConfig } from "../services/config";
import { generateImageB64 } from "../services/imageGeneration";
import { expandPrompt } from "../services/promptRefine";
import type { AppConfig } from "../types";
import { parsePositiveInt } from "../utils/numericInput";
import { PaintbrushLoading } from "./PaintbrushLoading";
import { ModalPortal } from "./ModalPortal";
import { Select } from "./Select";

export interface GenerateAssetFormValues {
  name: string;
  assetType: string;
  prompt: string;
  model: string;
  size: string;
  n: number;
  numInferenceSteps: number;
  generationDurationMs: number;
}

type GenerateAssetSubmitValues = Omit<
  GenerateAssetFormValues,
  "generationDurationMs"
>;

interface GenerateAssetModalProps {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onSubmit?: (values: GenerateAssetFormValues, imageB64: string) => Promise<void>;
  allowBackground?: boolean;
  onBackgroundSubmit?: (values: GenerateAssetSubmitValues) => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const SIZE_OPTIONS = ["1024x1024", "768x768", "512x512"];

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50 disabled:opacity-50";

const readOnlyClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-muted outline-none read-only:cursor-default read-only:opacity-70";

export function GenerateAssetModal({
  open,
  config,
  onClose,
  onSubmit,
  allowBackground = false,
  onBackgroundSubmit,
}: GenerateAssetModalProps) {
  const m = useTranslationMessages().creation.generateAssetModal;
  const errors = useTranslationMessages().errors;
  const defaultSize = config.imageDefaultSize.trim() || DEFAULT_IMAGE_SIZE;
  const imageModel = config.imageModel.trim();
  const imageCount =
    Number.isFinite(config.imageCount) && config.imageCount >= 1
      ? config.imageCount
      : DEFAULT_IMAGE_COUNT;
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("scene");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(defaultSize);
  const [numInferenceSteps, setNumInferenceSteps] = useState(
    String(DEFAULT_NUM_INFERENCE_STEPS),
  );
  const [submitting, setSubmitting] = useState(false);
  const [expandingPrompt, setExpandingPrompt] = useState(false);
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
    setNumInferenceSteps(String(DEFAULT_NUM_INFERENCE_STEPS));
    setExpandingPrompt(false);
    setError("");
  }, [config.imageModel, defaultSize, open]);

  const canSubmit =
    name.trim() && prompt.trim() && imageModel && !submitting && !expandingPrompt;

  const showExpandPromptButton = Boolean(prompt.trim()) && !submitting;
  const canExpandPrompt =
    showExpandPromptButton && !expandingPrompt;

  const promptRefineSettings = useMemo(
    () => getPromptRefineSettingsFromConfig(config),
    [config],
  );

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
      imageModel,
      imageDefaultSize: defaultSize,
      imageCount,
    }),
    [config.imageApiKey, config.imageApiUrl, defaultSize, imageCount, imageModel],
  );

  const handleClose = useCallback(() => {
    if (submitting) {
      abortRef.current = true;
      requestIdRef.current += 1;
      setSubmitting(false);
    }
    onClose();
  }, [onClose, submitting]);

  const handleExpandPrompt = useCallback(async () => {
    if (!canExpandPrompt) return;

    const requestId = ++requestIdRef.current;
    setExpandingPrompt(true);
    setError("");

    try {
      const expanded = await expandPrompt(prompt, promptRefineSettings);
      if (requestId !== requestIdRef.current) return;
      setPrompt(expanded);
    } catch (expandError) {
      if (requestId !== requestIdRef.current) return;
      const message =
        expandError instanceof Error ? expandError.message : String(expandError);
      if (message === "PROMPT_REFINE_CONFIG_REQUIRED") {
        setError(errors.promptRefineConfigRequired);
      } else if (message === "PROMPT_REQUIRED") {
        setError(errors.promptRequired);
      } else if (message === "PROMPT_REFINE_EMPTY_RESPONSE") {
        setError(errors.promptRefineEmptyResponse);
      } else {
        setError(message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setExpandingPrompt(false);
      }
    }
  }, [
    canExpandPrompt,
    errors.promptRefineConfigRequired,
    errors.promptRefineEmptyResponse,
    errors.promptRequired,
    prompt,
    promptRefineSettings,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    if (allowBackground && onBackgroundSubmit) {
      const resolvedNumInferenceSteps = parsePositiveInt(
        numInferenceSteps,
        DEFAULT_NUM_INFERENCE_STEPS,
      );
      onBackgroundSubmit({
        name: name.trim(),
        assetType,
        prompt: prompt.trim(),
        model: imageModel,
        size,
        n: imageCount,
        numInferenceSteps: resolvedNumInferenceSteps,
      });
      onClose();
      return;
    }

    if (!onSubmit) return;

    const requestId = ++requestIdRef.current;
    abortRef.current = false;
    setSubmitting(true);
    setError("");
    const startedAt = performance.now();
    try {
      const resolvedNumInferenceSteps = parsePositiveInt(
        numInferenceSteps,
        DEFAULT_NUM_INFERENCE_STEPS,
      );

      const imageB64 = await generateImageB64({
        prompt,
        size,
        model: imageModel,
        n: imageCount,
        numInferenceSteps: resolvedNumInferenceSteps,
        settings: imageSettings,
      });
      if (abortRef.current || requestId !== requestIdRef.current) return;

      const generationDurationMs = Math.max(0, Math.round(performance.now() - startedAt));

      await onSubmit(
        {
          name: name.trim(),
          assetType,
          prompt: prompt.trim(),
          model: imageModel,
          size,
          n: imageCount,
          numInferenceSteps: resolvedNumInferenceSteps,
          generationDurationMs,
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
    allowBackground,
    assetType,
    canSubmit,
    errors.imageConfigRequired,
    imageCount,
    imageModel,
    imageSettings,
    name,
    numInferenceSteps,
    onBackgroundSubmit,
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
            className={`relative z-10 flex max-h-[min(680px,calc(100dvh-4rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-surface shadow-2xl ${
              submitting || expandingPrompt
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

                <div className="block space-y-1.5">
                  <div className="flex min-h-7 items-center justify-between gap-3">
                    <span className="text-xs text-text-muted">{m.promptLabel}</span>
                    <button
                      type="button"
                      onClick={() => void handleExpandPrompt()}
                      disabled={!canExpandPrompt}
                      aria-hidden={!showExpandPromptButton}
                      tabIndex={showExpandPromptButton ? 0 : -1}
                      className={`inline-flex min-w-[5.75rem] shrink-0 items-center justify-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs text-accent transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-70 ${
                        showExpandPromptButton
                          ? ""
                          : "pointer-events-none invisible"
                      }`}
                    >
                      {expandingPrompt ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin />
                          {m.expandingPrompt}
                        </>
                      ) : (
                        m.expandPrompt
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder={m.promptPlaceholder}
                      rows={6}
                      disabled={submitting || expandingPrompt}
                      className="max-h-[240px] w-full resize-none overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-accent/50 disabled:opacity-50"
                    />
                    {expandingPrompt ? (
                      <div
                        className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 backdrop-blur-[1px]"
                        aria-live="polite"
                        aria-busy="true"
                      >
                        <FontAwesomeIcon icon={faSpinner} spin className="text-accent" />
                        <span className="text-sm text-text-muted">{m.expandingPrompt}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{m.modelLabel}</span>
                  <input
                    readOnly
                    value={imageModel}
                    placeholder={m.modelEmpty}
                    className={readOnlyClass}
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

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs text-text-muted">{m.countLabel}</span>
                    <input
                      readOnly
                      value={imageCount}
                      className={readOnlyClass}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs text-text-muted">{m.inferenceStepsLabel}</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={numInferenceSteps}
                      onChange={(event) => setNumInferenceSteps(event.target.value)}
                      disabled={submitting}
                      className={fieldClass}
                    />
                  </label>
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
