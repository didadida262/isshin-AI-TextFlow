import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useI18n, useTranslationMessages } from "../../contexts/I18nContext";
import { formatDurationMs } from "../../utils/formatDuration";
import type { PromptRefineSettings } from "../../services/config";
import { expandPrompt } from "../../services/promptRefine";
import { ModalPortal } from "../ModalPortal";

interface PromptRefineTestResultModalProps {
  open: boolean;
  settings: PromptRefineSettings | null;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const readOnlyClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-muted outline-none read-only:cursor-default read-only:opacity-70";

type TestPhase = "form" | "generating" | "success" | "error";

export function PromptRefineTestResultModal({
  open,
  settings,
  onClose,
}: PromptRefineTestResultModalProps) {
  const { locale } = useI18n();
  const i18n = useTranslationMessages().settings;
  const errors = useTranslationMessages().errors;
  const formLabels = useTranslationMessages().creation.generateAssetModal;
  const [phase, setPhase] = useState<TestPhase>("form");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const promptRefineModel = settings?.promptRefineModel?.trim() ?? "";
  const canRun = Boolean(settings && prompt.trim() && promptRefineModel);

  useEffect(() => {
    if (!open) return;
    requestIdRef.current += 1;
    setPhase("form");
    setPrompt("");
    setResult("");
    setError("");
    setElapsedMs(null);
  }, [open]);

  const handleClose = useCallback(() => {
    requestIdRef.current += 1;
    onClose();
  }, [onClose]);

  const resetToForm = useCallback(() => {
    requestIdRef.current += 1;
    setPhase("form");
    setResult("");
    setError("");
    setElapsedMs(null);
  }, []);

  const runTest = useCallback(() => {
    if (!settings || !canRun) return;

    const requestId = ++requestIdRef.current;
    const startedAt = performance.now();
    setPhase("generating");
    setResult("");
    setError("");
    setElapsedMs(null);

    void expandPrompt(prompt, settings)
      .then((expanded) => {
        if (requestId !== requestIdRef.current) return;
        setElapsedMs(Math.max(0, Math.round(performance.now() - startedAt)));
        setResult(expanded);
        setPhase("success");
      })
      .catch((testError) => {
        if (requestId !== requestIdRef.current) return;
        setElapsedMs(Math.max(0, Math.round(performance.now() - startedAt)));
        const message =
          testError instanceof Error ? testError.message : String(testError);
        setError(
          message === "PROMPT_REFINE_CONFIG_REQUIRED"
            ? errors.promptRefineConfigRequired
            : message === "PROMPT_REQUIRED"
              ? errors.promptRequired
              : message === "PROMPT_REFINE_EMPTY_RESPONSE"
                ? errors.promptRefineEmptyResponse
                : message,
        );
        setPhase("error");
      });
  }, [
    canRun,
    errors.promptRefineConfigRequired,
    errors.promptRefineEmptyResponse,
    errors.promptRequired,
    prompt,
    settings,
  ]);

  const generating = phase === "generating";
  const showForm = phase === "form";
  const showResult = phase === "success" || phase === "error";
  const showSuccess = phase === "success" && Boolean(result);

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && settings ? (
          <motion.div
            key="prompt-refine-test-result-modal"
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
              aria-labelledby="prompt-refine-test-title"
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
                <h3
                  id="prompt-refine-test-title"
                  className="text-base font-semibold text-white"
                >
                  {i18n.promptRefineTestTitle}
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
                        {i18n.promptRefineTestPromptLabel}
                      </span>
                      <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={i18n.promptRefineTestPlaceholder}
                        rows={4}
                        className="max-h-[160px] w-full resize-none overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-accent/50"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs text-text-muted">
                        {i18n.promptRefineModel}
                      </span>
                      <input readOnly value={promptRefineModel} className={readOnlyClass} />
                    </label>
                  </div>
                ) : null}

                {generating ? (
                  <div
                    className="flex min-h-[200px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/30 p-6 text-sm text-text-muted"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <FontAwesomeIcon icon={faSpinner} spin className="text-accent" />
                    {i18n.promptRefineExpanding}
                  </div>
                ) : null}

                {showResult ? (
                  <div className="space-y-4">
                    {showSuccess ? (
                      <>
                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {i18n.promptRefineTestResultLabel}
                          </span>
                          <div className="max-h-[min(40vh,320px)] overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-relaxed text-white">
                            {result}
                          </div>
                        </label>
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
                {showForm ? (
                  <button
                    type="button"
                    onClick={() => runTest()}
                    disabled={!canRun}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {i18n.promptRefineTestConfirm}
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
