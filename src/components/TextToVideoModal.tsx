import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useGenerationJobs } from "../contexts/GenerationJobsContext";
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
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_SIZE,
  loadConfig,
} from "../services/config";
import { generateVideoB64 } from "../services/videoGeneration";
import { parsePositiveFloat, parsePositiveInt } from "../utils/numericInput";
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

type TextToVideoSubmitValues = Omit<TextToVideoFormValues, "generationDurationMs">;

interface TextToVideoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (values: TextToVideoFormValues, videoB64: string) => Promise<void>;
  allowBackground?: boolean;
  onBackgroundSubmit?: (values: TextToVideoSubmitValues) => string;
  initialName?: string;
  initialPrompt?: string;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const SIZE_OPTIONS = ["832x480", "1280x720", "1024x576"];

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50 disabled:opacity-50";

const readOnlyClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-muted outline-none read-only:cursor-default read-only:opacity-70";

export function TextToVideoModal({
  open,
  onClose,
  onSubmit,
  allowBackground = false,
  onBackgroundSubmit,
  initialName = "",
  initialPrompt = "",
}: TextToVideoModalProps) {
  const m = useTranslationMessages().creation.textToVideoModal;
  const errors = useTranslationMessages().errors;
  const [videoModel, setVideoModel] = useState(DEFAULT_VIDEO_MODEL);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(DEFAULT_VIDEO_SIZE);
  const [numFrames, setNumFrames] = useState(String(DEFAULT_VIDEO_NUM_FRAMES));
  const [fps, setFps] = useState(String(DEFAULT_VIDEO_FPS));
  const [numInferenceSteps, setNumInferenceSteps] = useState(
    String(DEFAULT_VIDEO_INFERENCE_STEPS),
  );
  const [guidanceScale, setGuidanceScale] = useState(
    String(DEFAULT_VIDEO_GUIDANCE_SCALE),
  );
  const [guidanceScale2, setGuidanceScale2] = useState(
    String(DEFAULT_VIDEO_GUIDANCE_SCALE_2),
  );
  const [boundaryRatio, setBoundaryRatio] = useState(
    String(DEFAULT_VIDEO_BOUNDARY_RATIO),
  );
  const [flowShift, setFlowShift] = useState(String(DEFAULT_VIDEO_FLOW_SHIFT));
  const [seed, setSeed] = useState(String(DEFAULT_VIDEO_SEED));
  const [submitting, setSubmitting] = useState(false);
  const [backgroundJobId, setBackgroundJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef(false);
  const requestIdRef = useRef(0);
  const { jobs } = useGenerationJobs();

  const backgroundJob = useMemo(
    () =>
      backgroundJobId
        ? jobs.find((job) => job.id === backgroundJobId)
        : undefined,
    [backgroundJobId, jobs],
  );
  const isBackgroundGenerating = backgroundJobId != null;

  useEffect(() => {
    if (!open) return;
    abortRef.current = false;
    requestIdRef.current += 1;
    void loadConfig().then((config) => {
      setVideoModel(config.videoModel.trim() || DEFAULT_VIDEO_MODEL);
    });
    setName(initialName.trim());
    setPrompt(initialPrompt.trim());
    setSize(DEFAULT_VIDEO_SIZE);
    setNumFrames(String(DEFAULT_VIDEO_NUM_FRAMES));
    setFps(String(DEFAULT_VIDEO_FPS));
    setNumInferenceSteps(String(DEFAULT_VIDEO_INFERENCE_STEPS));
    setGuidanceScale(String(DEFAULT_VIDEO_GUIDANCE_SCALE));
    setGuidanceScale2(String(DEFAULT_VIDEO_GUIDANCE_SCALE_2));
    setBoundaryRatio(String(DEFAULT_VIDEO_BOUNDARY_RATIO));
    setFlowShift(String(DEFAULT_VIDEO_FLOW_SHIFT));
    setSeed(String(DEFAULT_VIDEO_SEED));
    setSubmitting(false);
    setBackgroundJobId(null);
    setError("");
  }, [initialName, initialPrompt, open]);

  useEffect(() => {
    if (!backgroundJob || backgroundJob.status === "running") return;

    if (backgroundJob.status === "success") {
      onClose();
      return;
    }

    const message = backgroundJob.errorMessage ?? errors.videoConfigRequired;
    setSubmitting(false);
    setBackgroundJobId(null);
    setError(
      message === "VIDEO_CONFIG_REQUIRED" ? errors.videoConfigRequired : message,
    );
  }, [backgroundJob, errors.videoConfigRequired, onClose]);

  const canSubmit = name.trim() && prompt.trim() && !submitting;

  const sizeOptions = useMemo(
    () =>
      [...new Set([DEFAULT_VIDEO_SIZE, ...SIZE_OPTIONS])].map((option) => ({
        value: option,
        label: option,
      })),
    [],
  );

  const handleClose = useCallback(() => {
    if (submitting && !isBackgroundGenerating) {
      abortRef.current = true;
      requestIdRef.current += 1;
      setSubmitting(false);
    }
    setBackgroundJobId(null);
    onClose();
  }, [isBackgroundGenerating, onClose, submitting]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    if (allowBackground && onBackgroundSubmit) {
      const jobId = onBackgroundSubmit({
        name: name.trim(),
        prompt: prompt.trim(),
        model: videoModel || m.modelDefault,
        size,
        numFrames: parsePositiveInt(numFrames, DEFAULT_VIDEO_NUM_FRAMES),
        fps: parsePositiveInt(fps, DEFAULT_VIDEO_FPS),
        numInferenceSteps: parsePositiveInt(
          numInferenceSteps,
          DEFAULT_VIDEO_INFERENCE_STEPS,
        ),
        guidanceScale: parsePositiveFloat(guidanceScale, DEFAULT_VIDEO_GUIDANCE_SCALE),
        guidanceScale2: parsePositiveFloat(
          guidanceScale2,
          DEFAULT_VIDEO_GUIDANCE_SCALE_2,
        ),
        boundaryRatio: parsePositiveFloat(
          boundaryRatio,
          DEFAULT_VIDEO_BOUNDARY_RATIO,
        ),
        flowShift: parsePositiveFloat(flowShift, DEFAULT_VIDEO_FLOW_SHIFT),
        seed: parsePositiveInt(seed, DEFAULT_VIDEO_SEED),
      });
      setBackgroundJobId(jobId);
      setSubmitting(true);
      setError("");
      return;
    }

    if (!onSubmit) return;

    const requestId = ++requestIdRef.current;
    abortRef.current = false;
    setSubmitting(true);
    setError("");
    const startedAt = performance.now();
    try {
      const resolvedNumFrames = parsePositiveInt(numFrames, DEFAULT_VIDEO_NUM_FRAMES);
      const resolvedFps = parsePositiveInt(fps, DEFAULT_VIDEO_FPS);
      const resolvedNumInferenceSteps = parsePositiveInt(
        numInferenceSteps,
        DEFAULT_VIDEO_INFERENCE_STEPS,
      );
      const resolvedGuidanceScale = parsePositiveFloat(
        guidanceScale,
        DEFAULT_VIDEO_GUIDANCE_SCALE,
      );
      const resolvedGuidanceScale2 = parsePositiveFloat(
        guidanceScale2,
        DEFAULT_VIDEO_GUIDANCE_SCALE_2,
      );
      const resolvedBoundaryRatio = parsePositiveFloat(
        boundaryRatio,
        DEFAULT_VIDEO_BOUNDARY_RATIO,
      );
      const resolvedFlowShift = parsePositiveFloat(flowShift, DEFAULT_VIDEO_FLOW_SHIFT);
      const resolvedSeed = parsePositiveInt(seed, DEFAULT_VIDEO_SEED);

      const videoB64 = await generateVideoB64({
        prompt,
        size,
        numFrames: resolvedNumFrames,
        fps: resolvedFps,
        numInferenceSteps: resolvedNumInferenceSteps,
        guidanceScale: resolvedGuidanceScale,
        guidanceScale2: resolvedGuidanceScale2,
        boundaryRatio: resolvedBoundaryRatio,
        flowShift: resolvedFlowShift,
        seed: resolvedSeed,
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
          numFrames: resolvedNumFrames,
          fps: resolvedFps,
          numInferenceSteps: resolvedNumInferenceSteps,
          guidanceScale: resolvedGuidanceScale,
          guidanceScale2: resolvedGuidanceScale2,
          boundaryRatio: resolvedBoundaryRatio,
          flowShift: resolvedFlowShift,
          seed: resolvedSeed,
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
    allowBackground,
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
    onBackgroundSubmit,
    onClose,
    onSubmit,
    prompt,
    seed,
    size,
    videoModel,
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
              onClick={submitting && !isBackgroundGenerating ? undefined : handleClose}
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
                {!submitting || isBackgroundGenerating ? (
                  <button
                    type="button"
                    onClick={handleClose}
                    title={isBackgroundGenerating ? m.closeWhileGenerating : m.cancel}
                    aria-label={
                      isBackgroundGenerating ? m.closeWhileGenerating : m.cancel
                    }
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
                          rows={6}
                          disabled={submitting}
                          className="min-h-[240px] max-h-[240px] w-full resize-none overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-accent/50 disabled:opacity-50"
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
                            onChange={(event) => setNumFrames(event.target.value)}
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
                            onChange={(event) => setFps(event.target.value)}
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
                          onChange={(event) => setNumInferenceSteps(event.target.value)}
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
                            onChange={(event) => setGuidanceScale(event.target.value)}
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
                            onChange={(event) => setGuidanceScale2(event.target.value)}
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
                            onChange={(event) => setBoundaryRatio(event.target.value)}
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
                            onChange={(event) => setFlowShift(event.target.value)}
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
                            setSeed(event.target.value)
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
                      <div className="flex flex-col items-center gap-3">
                        <PaintbrushLoading label={m.generating} />
                        {isBackgroundGenerating ? (
                          <p className="max-w-xs text-center text-xs text-text-muted">
                            {m.backgroundGeneratingHint}
                          </p>
                        ) : null}
                      </div>
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
                  {submitting
                    ? isBackgroundGenerating
                      ? m.closeWhileGenerating
                      : m.abortGenerating
                    : m.cancel}
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
