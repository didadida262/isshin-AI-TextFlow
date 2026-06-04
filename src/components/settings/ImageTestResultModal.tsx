import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faDownload,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { downloadBase64Media } from "../../services/mediaDownload";
import { useI18n, useTranslationMessages } from "../../contexts/I18nContext";
import { formatDurationMs } from "../../utils/formatDuration";
import {
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_NUM_INFERENCE_STEPS,
  type ImageGenerationSettings,
} from "../../services/config";
import {
  generateImageB64,
  IMAGE_TEST_PROMPT,
} from "../../services/imageGeneration";
import { ModalPortal } from "../ModalPortal";
import { PaintbrushLoading } from "../PaintbrushLoading";
import { Select } from "../Select";

interface ImageTestResultModalProps {
  open: boolean;
  settings: ImageGenerationSettings | null;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };
const SIZE_OPTIONS = ["1024x1024", "768x768", "512x512"];

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50 disabled:opacity-50";

const readOnlyClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-muted outline-none read-only:cursor-default read-only:opacity-70";

type TestPhase = "form" | "generating" | "success" | "error";

function toImageSrc(b64: string): string {
  const cleaned = b64
    .trim()
    .replace(/^data:image\/[a-z+]+;base64,/, "");
  return `data:image/png;base64,${cleaned}`;
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

export function ImageTestResultModal({
  open,
  settings,
  onClose,
}: ImageTestResultModalProps) {
  const { locale } = useI18n();
  const i18n = useTranslationMessages().settings;
  const errors = useTranslationMessages().errors;
  const formLabels = useTranslationMessages().creation.generateAssetModal;
  const [phase, setPhase] = useState<TestPhase>("form");
  const [prompt, setPrompt] = useState(IMAGE_TEST_PROMPT);
  const [size, setSize] = useState(DEFAULT_IMAGE_SIZE);
  const [numInferenceSteps, setNumInferenceSteps] = useState(
    DEFAULT_NUM_INFERENCE_STEPS,
  );
  const [imageB64, setImageB64] = useState("");
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const defaultSize =
    settings?.imageDefaultSize?.trim() || DEFAULT_IMAGE_SIZE;
  const imageModel = settings?.imageModel?.trim() ?? "";
  const imageCount = settings?.imageCount ?? DEFAULT_IMAGE_COUNT;

  useEffect(() => {
    if (!open) return;
    requestIdRef.current += 1;
    setPhase("form");
    setPrompt(IMAGE_TEST_PROMPT);
    setSize(defaultSize);
    setNumInferenceSteps(DEFAULT_NUM_INFERENCE_STEPS);
    setImageB64("");
    setError("");
    setElapsedMs(null);
  }, [defaultSize, open]);

  const sizeOptions = useMemo(() => {
    const options = new Set([defaultSize, ...SIZE_OPTIONS]);
    return [...options].map((option) => ({ value: option, label: option }));
  }, [defaultSize]);

  const canRun = Boolean(settings && prompt.trim() && imageModel);

  const handleClose = useCallback(() => {
    requestIdRef.current += 1;
    onClose();
  }, [onClose]);

  const resetToForm = useCallback(() => {
    requestIdRef.current += 1;
    setPhase("form");
    setImageB64("");
    setError("");
    setElapsedMs(null);
  }, []);

  const runTest = useCallback(() => {
    if (!settings || !canRun) return;

    const requestId = ++requestIdRef.current;
    const startedAt = performance.now();
    setPhase("generating");
    setImageB64("");
    setError("");
    setElapsedMs(null);

    void generateImageB64({
      prompt,
      size,
      model: imageModel,
      n: imageCount,
      numInferenceSteps,
      settings,
    })
      .then((b64) => {
        if (requestId !== requestIdRef.current) return;
        setElapsedMs(Math.max(0, Math.round(performance.now() - startedAt)));
        setImageB64(b64);
        setPhase("success");
      })
      .catch((testError) => {
        if (requestId !== requestIdRef.current) return;
        setElapsedMs(Math.max(0, Math.round(performance.now() - startedAt)));
        const message =
          testError instanceof Error ? testError.message : String(testError);
        setError(
          message === "IMAGE_CONFIG_REQUIRED"
            ? errors.imageConfigRequired
            : message,
        );
        setPhase("error");
      });
  }, [
    canRun,
    errors.imageConfigRequired,
    imageCount,
    imageModel,
    numInferenceSteps,
    prompt,
    settings,
    size,
  ]);

  const generating = phase === "generating";
  const showForm = phase === "form";
  const showResult = phase === "success" || phase === "error";
  const showSuccess = phase === "success" && Boolean(imageB64);

  const handleDownload = useCallback(() => {
    if (!imageB64) return;
    void downloadBase64Media("image", imageB64, {
      dialogTitle: i18n.imageTestDownloadTitle,
    });
  }, [i18n.imageTestDownloadTitle, imageB64]);

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && settings ? (
          <motion.div
            key="image-test-result-modal"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={formLabels.cancel}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={generating ? undefined : handleClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="image-test-title"
              className={`relative z-10 flex max-h-[min(680px,calc(100dvh-4rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-surface shadow-2xl ${
                generating
                  ? "modal-generating-border border-transparent"
                  : "border-white/10"
              }`}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
                <h3 id="image-test-title" className="text-base font-semibold text-white">
                  {i18n.imageTestTitle}
                </h3>
                {!generating ? (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <p className="mb-4 text-xs text-text-dim">{i18n.testEphemeralHint}</p>

                {showForm ? (
                  <div className="space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs text-text-muted">
                        {i18n.imageTestPromptLabel}
                      </span>
                      <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={formLabels.promptPlaceholder}
                        rows={3}
                        className="max-h-[120px] w-full resize-none overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-accent/50"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs text-text-muted">{formLabels.modelLabel}</span>
                      <input readOnly value={imageModel} className={readOnlyClass} />
                    </label>

                    <div className="block space-y-1.5">
                      <span className="text-xs text-text-muted">{formLabels.sizeLabel}</span>
                      <Select value={size} options={sizeOptions} onChange={setSize} />
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-xs text-text-muted">
                        {formLabels.inferenceStepsLabel}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={numInferenceSteps}
                        onChange={(event) =>
                          setNumInferenceSteps(
                            parsePositiveInt(
                              event.target.value,
                              DEFAULT_NUM_INFERENCE_STEPS,
                            ),
                          )
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>
                ) : null}

                {generating ? (
                  <div
                    className="flex min-h-[240px] items-center justify-center rounded-lg border border-white/10 bg-black/30 p-6"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <PaintbrushLoading label={formLabels.generating} />
                  </div>
                ) : null}

                {showResult ? (
                  <div className="space-y-4">
                    {phase === "success" ? (
                      <>
                        <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-white/10 bg-black/30 p-3">
                          <img
                            src={toImageSrc(imageB64)}
                            alt={prompt}
                            className="max-h-[min(50vh,420px)] w-auto max-w-full rounded-md object-contain"
                          />
                        </div>
                        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-2 text-sm text-accent">
                            <FontAwesomeIcon icon={faCircleCheck} />
                            {i18n.connectionOk}
                          </span>
                          {elapsedMs != null ? (
                            <span className="text-xs text-text-muted">
                              {i18n.testDurationLabel}：
                              {formatDurationMs(elapsedMs, locale)}
                            </span>
                          ) : null}
                        </p>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                        <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-red-300">
                          <FontAwesomeIcon
                            icon={faCircleExclamation}
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0 break-words">{error}</span>
                        </p>
                        {elapsedMs != null ? (
                          <span className="shrink-0 text-xs text-text-muted">
                            {i18n.testDurationLabel}：
                            {formatDurationMs(elapsedMs, locale)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-5 py-3.5">
                <button
                  type="button"
                  onClick={generating ? handleClose : showResult ? resetToForm : handleClose}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  {generating
                    ? formLabels.abortGenerating
                    : showResult
                      ? i18n.testAgain
                      : formLabels.cancel}
                </button>
                {showSuccess ? (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5"
                  >
                    <FontAwesomeIcon icon={faDownload} className="text-xs" />
                    {i18n.download}
                  </button>
                ) : null}
                {showForm ? (
                  <button
                    type="button"
                    onClick={() => runTest()}
                    disabled={!canRun}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {i18n.imageTestConfirm}
                  </button>
                ) : showResult ? (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90"
                  >
                    {i18n.testClose}
                  </button>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
