import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  DEFAULT_VIDEO_BOUNDARY_RATIO,
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_FLOW_SHIFT,
  DEFAULT_VIDEO_GUIDANCE_SCALE,
  DEFAULT_VIDEO_GUIDANCE_SCALE_2,
  DEFAULT_VIDEO_INFERENCE_STEPS,
  DEFAULT_VIDEO_NUM_FRAMES,
  DEFAULT_VIDEO_SEED,
  DEFAULT_VIDEO_SIZE,
  getFixedVideoSettings,
} from "../services/config";
import { generateVideoB64 } from "../services/videoGeneration";
import { PaintbrushLoading } from "./PaintbrushLoading";
import { ModalPortal } from "./ModalPortal";
import { Select } from "./Select";

export interface TextToVideoFormValues {
  name: string;
  prompt: string;
  model: string;
  size: string;
  numFrames: number;
  fps: number;
  numInferenceSteps: number;
  guidanceScale: number;
  guidanceScale2: number;
  boundaryRatio: number;
  flowShift: number;
  seed: number;
  generationDurationMs: number;
}

interface TextToVideoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: TextToVideoFormValues, videoB64: string) => Promise<void>;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const SIZE_OPTIONS = ["832x480", "1280x720", "1024x576"];

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50 disabled:opacity-50";

const readOnlyClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-muted outline-none read-only:cursor-default read-only:opacity-70";

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePositiveFloat(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function TextToVideoModal({
  open,
  onClose,
  onSubmit,
}: TextToVideoModalProps) {
  const m = useTranslationMessages().creation.textToVideoModal;
  const errors = useTranslationMessages().errors;
  const videoModel = getFixedVideoSettings().videoModel;
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(DEFAULT_VIDEO_SIZE);
  const [numFrames, setNumFrames] = useState(DEFAULT_VIDEO_NUM_FRAMES);
  const [fps, setFps] = useState(DEFAULT_VIDEO_FPS);
  const [numInferenceSteps, setNumInferenceSteps] = useState(
    DEFAULT_VIDEO_INFERENCE_STEPS,
  );
  const [guidanceScale, setGuidanceScale] = useState(DEFAULT_VIDEO_GUIDANCE_SCALE);
  const [guidanceScale2, setGuidanceScale2] = useState(
    DEFAULT_VIDEO_GUIDANCE_SCALE_2,
  );
  const [boundaryRatio, setBoundaryRatio] = useState(DEFAULT_VIDEO_BOUNDARY_RATIO);
  const [flowShift, setFlowShift] = useState(DEFAULT_VIDEO_FLOW_SHIFT);
  const [seed, setSeed] = useState(DEFAULT_VIDEO_SEED);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    abortRef.current = false;
    requestIdRef.current += 1;
    setName("");
    setPrompt("");
    setSize(DEFAULT_VIDEO_SIZE);
    setNumFrames(DEFAULT_VIDEO_NUM_FRAMES);
    setFps(DEFAULT_VIDEO_FPS);
    setNumInferenceSteps(DEFAULT_VIDEO_INFERENCE_STEPS);
    setGuidanceScale(DEFAULT_VIDEO_GUIDANCE_SCALE);
    setGuidanceScale2(DEFAULT_VIDEO_GUIDANCE_SCALE_2);
    setBoundaryRatio(DEFAULT_VIDEO_BOUNDARY_RATIO);
    setFlowShift(DEFAULT_VIDEO_FLOW_SHIFT);
    setSeed(DEFAULT_VIDEO_SEED);
    setError("");
  }, [open]);

  const canSubmit = name.trim() && prompt.trim() && !submitting;

  const sizeOptions = useMemo(
    () =>
      [...new Set([DEFAULT_VIDEO_SIZE, ...SIZE_OPTIONS])].map((option) => ({
        value: option,
        label: option,
      })),
    [],
  );

  const videoSettings = useMemo(() => getFixedVideoSettings(), []);

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
    const startedAt = performance.now();
    try {
      const videoB64 = await generateVideoB64({
        prompt,
        size,
        numFrames,
        fps,
        numInferenceSteps,
        guidanceScale,
        guidanceScale2,
        boundaryRatio,
        flowShift,
        seed,
        settings: videoSettings,
      });
      if (abortRef.current || requestId !== requestIdRef.current) return;

      const generationDurationMs = Math.max(
        0,
        Math.round(performance.now() - startedAt),
      );

      await onSubmit(
        {
          name: name.trim(),
          prompt: prompt.trim(),
          model: videoModel || m.modelDefault,
          size,
          numFrames,
          fps,
          numInferenceSteps,
          guidanceScale,
          guidanceScale2,
          boundaryRatio,
          flowShift,
          seed,
          generationDurationMs,
        },
        videoB64,
      );
      if (abortRef.current || requestId !== requestIdRef.current) return;
      onClose();
    } catch (submitError) {
      if (abortRef.current || requestId !== requestIdRef.current) return;
      const message =
        submitError instanceof Error ? submitError.message : String(submitError);
      setError(
        message === "VIDEO_CONFIG_REQUIRED"
          ? errors.videoConfigRequired
          : message,
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setSubmitting(false);
      }
    }
  }, [
    boundaryRatio,
    canSubmit,
    errors.videoConfigRequired,
    flowShift,
    fps,
    guidanceScale,
    guidanceScale2,
    m.modelDefault,
    name,
    numFrames,
    numInferenceSteps,
    onClose,
    onSubmit,
    prompt,
    seed,
    size,
    videoModel,
    videoSettings,
  ]);

  return (
    <ModalPortal>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="text-to-video-modal"
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
              aria-labelledby="text-to-video-title"
              className={`relative z-10 flex max-h-[min(760px,calc(100dvh-4rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-surface shadow-2xl ${
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
                <h3
                  id="text-to-video-title"
                  className="text-base font-semibold text-white"
                >
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

                      <label className="block space-y-1.5">
                        <span className="text-xs text-text-muted">{m.modelLabel}</span>
                        <input
                          readOnly
                          value={videoModel || m.modelDefault}
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
                          <span className="text-xs text-text-muted">{m.numFramesLabel}</span>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={numFrames}
                            onChange={(event) =>
                              setNumFrames(
                                parsePositiveInt(
                                  event.target.value,
                                  DEFAULT_VIDEO_NUM_FRAMES,
                                ),
                              )
                            }
                            disabled={submitting}
                            className={fieldClass}
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">{m.fpsLabel}</span>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={fps}
                            onChange={(event) =>
                              setFps(parsePositiveInt(event.target.value, DEFAULT_VIDEO_FPS))
                            }
                            disabled={submitting}
                            className={fieldClass}
                          />
                        </label>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs text-text-muted">
                          {m.inferenceStepsLabel}
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
                                DEFAULT_VIDEO_INFERENCE_STEPS,
                              ),
                            )
                          }
                          disabled={submitting}
                          className={fieldClass}
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {m.guidanceScaleLabel}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={guidanceScale}
                            onChange={(event) =>
                              setGuidanceScale(
                                parsePositiveFloat(
                                  event.target.value,
                                  DEFAULT_VIDEO_GUIDANCE_SCALE,
                                ),
                              )
                            }
                            disabled={submitting}
                            className={fieldClass}
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {m.guidanceScale2Label}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={guidanceScale2}
                            onChange={(event) =>
                              setGuidanceScale2(
                                parsePositiveFloat(
                                  event.target.value,
                                  DEFAULT_VIDEO_GUIDANCE_SCALE_2,
                                ),
                              )
                            }
                            disabled={submitting}
                            className={fieldClass}
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {m.boundaryRatioLabel}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.001}
                            value={boundaryRatio}
                            onChange={(event) =>
                              setBoundaryRatio(
                                parsePositiveFloat(
                                  event.target.value,
                                  DEFAULT_VIDEO_BOUNDARY_RATIO,
                                ),
                              )
                            }
                            disabled={submitting}
                            className={fieldClass}
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">{m.flowShiftLabel}</span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={flowShift}
                            onChange={(event) =>
                              setFlowShift(
                                parsePositiveFloat(
                                  event.target.value,
                                  DEFAULT_VIDEO_FLOW_SHIFT,
                                ),
                              )
                            }
                            disabled={submitting}
                            className={fieldClass}
                          />
                        </label>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs text-text-muted">{m.seedLabel}</span>
                        <input
                          type="number"
                          value={seed}
                          onChange={(event) =>
                            setSeed(parsePositiveInt(event.target.value, DEFAULT_VIDEO_SEED))
                          }
                          disabled={submitting}
                          className={fieldClass}
                        />
                      </label>

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
