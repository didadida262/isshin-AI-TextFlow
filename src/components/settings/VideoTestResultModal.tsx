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
import { parsePositiveFloat, parsePositiveInt } from "../../utils/numericInput";
import {
  DEFAULT_KUAIZI_VIDEO_DURATION,
  DEFAULT_KUAIZI_VIDEO_GENERATION_TYPE,
  DEFAULT_KUAIZI_VIDEO_MODE,
  DEFAULT_KUAIZI_VIDEO_RATIO,
  DEFAULT_KUAIZI_VIDEO_RESOLUTION,
  DEFAULT_VIDEO_BOUNDARY_RATIO,
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_FLOW_SHIFT,
  DEFAULT_VIDEO_GUIDANCE_SCALE,
  DEFAULT_VIDEO_GUIDANCE_SCALE_2,
  DEFAULT_VIDEO_INFERENCE_STEPS,
  DEFAULT_VIDEO_NUM_FRAMES,
  DEFAULT_VIDEO_SEED,
  DEFAULT_VIDEO_SIZE,
  getDefaultKuaiziVideoParams,
  isKuaiziVideoApi,
  type VideoGenerationSettings,
} from "../../services/config";
import {
  generateVideoB64,
  VIDEO_TEST_PROMPT,
} from "../../services/videoGeneration";
import { ModalPortal } from "../ModalPortal";
import { PaintbrushLoading } from "../PaintbrushLoading";
import { Select } from "../Select";

interface VideoTestResultModalProps {
  open: boolean;
  settings: VideoGenerationSettings | null;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };
const SIZE_OPTIONS = ["832x480", "1280x720", "1024x576"];
const KUAIZI_MODE_OPTIONS = ["fast"];
const KUAIZI_RESOLUTION_OPTIONS = ["480p", "720p", "1080p"];
const KUAIZI_RATIO_OPTIONS = ["16:9", "9:16", "1:1", "4:3", "3:4"];

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50 disabled:opacity-50";

const readOnlyClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-muted outline-none read-only:cursor-default read-only:opacity-70";

type TestPhase = "form" | "generating" | "success" | "error";

function toVideoSrc(b64: string): string {
  const cleaned = b64.trim().replace(/^data:video\/mp4;base64,/, "");
  return `data:video/mp4;base64,${cleaned}`;
}

export function VideoTestResultModal({
  open,
  settings,
  onClose,
}: VideoTestResultModalProps) {
  const { locale } = useI18n();
  const i18n = useTranslationMessages().settings;
  const errors = useTranslationMessages().errors;
  const formLabels = useTranslationMessages().creation.textToVideoModal;
  const [phase, setPhase] = useState<TestPhase>("form");
  const [prompt, setPrompt] = useState(VIDEO_TEST_PROMPT);
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
  const [kuaiziMode, setKuaiziMode] = useState(DEFAULT_KUAIZI_VIDEO_MODE);
  const [kuaiziResolution, setKuaiziResolution] = useState(
    DEFAULT_KUAIZI_VIDEO_RESOLUTION,
  );
  const [kuaiziRatio, setKuaiziRatio] = useState(DEFAULT_KUAIZI_VIDEO_RATIO);
  const [kuaiziDuration, setKuaiziDuration] = useState(
    String(DEFAULT_KUAIZI_VIDEO_DURATION),
  );
  const [kuaiziGenerationType, setKuaiziGenerationType] = useState(
    DEFAULT_KUAIZI_VIDEO_GENERATION_TYPE,
  );
  const [videoB64, setVideoB64] = useState("");
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const videoModel = settings?.videoModel?.trim() ?? "";
  const isKuaizi = Boolean(settings && isKuaiziVideoApi(settings.videoApiUrl));

  useEffect(() => {
    if (!open) return;
    requestIdRef.current += 1;
    const kuaiziDefaults = getDefaultKuaiziVideoParams();
    setPhase("form");
    setPrompt(VIDEO_TEST_PROMPT);
    setSize(DEFAULT_VIDEO_SIZE);
    setNumFrames(String(DEFAULT_VIDEO_NUM_FRAMES));
    setFps(String(DEFAULT_VIDEO_FPS));
    setNumInferenceSteps(String(DEFAULT_VIDEO_INFERENCE_STEPS));
    setGuidanceScale(String(DEFAULT_VIDEO_GUIDANCE_SCALE));
    setGuidanceScale2(String(DEFAULT_VIDEO_GUIDANCE_SCALE_2));
    setBoundaryRatio(String(DEFAULT_VIDEO_BOUNDARY_RATIO));
    setFlowShift(String(DEFAULT_VIDEO_FLOW_SHIFT));
    setSeed(String(DEFAULT_VIDEO_SEED));
    setKuaiziMode(kuaiziDefaults.mode);
    setKuaiziResolution(kuaiziDefaults.resolution);
    setKuaiziRatio(kuaiziDefaults.ratio);
    setKuaiziDuration(String(kuaiziDefaults.duration));
    setKuaiziGenerationType(kuaiziDefaults.generationType);
    setVideoB64("");
    setError("");
    setElapsedMs(null);
  }, [open]);

  const sizeOptions = useMemo(
    () =>
      [...new Set([DEFAULT_VIDEO_SIZE, ...SIZE_OPTIONS])].map((option) => ({
        value: option,
        label: option,
      })),
    [],
  );

  const canRun = Boolean(settings && prompt.trim());

  const handleClose = useCallback(() => {
    requestIdRef.current += 1;
    onClose();
  }, [onClose]);

  const resetToForm = useCallback(() => {
    requestIdRef.current += 1;
    setPhase("form");
    setVideoB64("");
    setError("");
    setElapsedMs(null);
  }, []);

  const runTest = useCallback(() => {
    if (!settings || !canRun) return;

    const requestId = ++requestIdRef.current;
    const startedAt = performance.now();
    setPhase("generating");
    setVideoB64("");
    setError("");
    setElapsedMs(null);

    void generateVideoB64(
      isKuaizi
        ? {
            prompt,
            settings,
            kuaizi: {
              mode: kuaiziMode,
              resolution: kuaiziResolution,
              ratio: kuaiziRatio,
              duration: parsePositiveInt(
                kuaiziDuration,
                DEFAULT_KUAIZI_VIDEO_DURATION,
              ),
              generationType: kuaiziGenerationType,
            },
          }
        : {
            prompt,
            size,
            numFrames: parsePositiveInt(numFrames, DEFAULT_VIDEO_NUM_FRAMES),
            fps: parsePositiveInt(fps, DEFAULT_VIDEO_FPS),
            numInferenceSteps: parsePositiveInt(
              numInferenceSteps,
              DEFAULT_VIDEO_INFERENCE_STEPS,
            ),
            guidanceScale: parsePositiveFloat(
              guidanceScale,
              DEFAULT_VIDEO_GUIDANCE_SCALE,
            ),
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
            settings,
          },
    )
      .then((b64) => {
        if (requestId !== requestIdRef.current) return;
        setElapsedMs(Math.max(0, Math.round(performance.now() - startedAt)));
        setVideoB64(b64);
        setPhase("success");
      })
      .catch((testError) => {
        if (requestId !== requestIdRef.current) return;
        setElapsedMs(Math.max(0, Math.round(performance.now() - startedAt)));
        const message =
          testError instanceof Error ? testError.message : String(testError);
        setError(
          message === "VIDEO_CONFIG_REQUIRED"
            ? errors.videoConfigRequired
            : message,
        );
        setPhase("error");
      });
  }, [
    boundaryRatio,
    canRun,
    errors.videoConfigRequired,
    flowShift,
    fps,
    guidanceScale,
    guidanceScale2,
    isKuaizi,
    kuaiziDuration,
    kuaiziGenerationType,
    kuaiziMode,
    kuaiziRatio,
    kuaiziResolution,
    numFrames,
    numInferenceSteps,
    prompt,
    seed,
    settings,
    size,
  ]);

  const generating = phase === "generating";
  const showForm = phase === "form";
  const showResult = phase === "success" || phase === "error";
  const showSuccess = phase === "success" && Boolean(videoB64);

  const handleDownload = useCallback(() => {
    if (!videoB64) return;
    void downloadBase64Media("video", videoB64, {
      dialogTitle: i18n.videoTestDownloadTitle,
    });
  }, [i18n.videoTestDownloadTitle, videoB64]);

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && settings ? (
          <motion.div
            key="video-test-result-modal"
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
              aria-labelledby="video-test-title"
              className={`relative z-10 flex max-h-[min(760px,calc(100dvh-4rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-surface shadow-2xl ${
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
                <h3 id="video-test-title" className="text-base font-semibold text-white">
                  {i18n.videoTestTitle}
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
                        {i18n.videoTestPromptLabel}
                      </span>
                      <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={formLabels.promptPlaceholder}
                        rows={6}
                        className="max-h-[240px] w-full resize-none overflow-y-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-accent/50"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs text-text-muted">{formLabels.modelLabel}</span>
                      <input
                        readOnly
                        value={
                          isKuaizi
                            ? i18n.kuaiziVideoModelNotUsed
                            : videoModel || formLabels.modelDefault
                        }
                        className={readOnlyClass}
                      />
                    </label>

                    {isKuaizi ? (
                      <>
                        <div className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {i18n.kuaiziVideoModeLabel}
                          </span>
                          <Select
                            value={kuaiziMode}
                            options={KUAIZI_MODE_OPTIONS.map((option) => ({
                              value: option,
                              label: option,
                            }))}
                            onChange={setKuaiziMode}
                          />
                        </div>

                        <div className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {i18n.kuaiziVideoResolutionLabel}
                          </span>
                          <Select
                            value={kuaiziResolution}
                            options={KUAIZI_RESOLUTION_OPTIONS.map((option) => ({
                              value: option,
                              label: option,
                            }))}
                            onChange={setKuaiziResolution}
                          />
                        </div>

                        <div className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {i18n.kuaiziVideoRatioLabel}
                          </span>
                          <Select
                            value={kuaiziRatio}
                            options={KUAIZI_RATIO_OPTIONS.map((option) => ({
                              value: option,
                              label: option,
                            }))}
                            onChange={setKuaiziRatio}
                          />
                        </div>

                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {i18n.kuaiziVideoDurationLabel}
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={kuaiziDuration}
                            onChange={(event) => setKuaiziDuration(event.target.value)}
                            className={fieldClass}
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">
                            {i18n.kuaiziVideoGenerationTypeLabel}
                          </span>
                          <input
                            readOnly
                            value={kuaiziGenerationType}
                            className={readOnlyClass}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <div className="block space-y-1.5">
                          <span className="text-xs text-text-muted">{formLabels.sizeLabel}</span>
                          <Select value={size} options={sizeOptions} onChange={setSize} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block space-y-1.5">
                            <span className="text-xs text-text-muted">
                              {formLabels.numFramesLabel}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={numFrames}
                              onChange={(event) => setNumFrames(event.target.value)}
                              className={fieldClass}
                            />
                          </label>

                          <label className="block space-y-1.5">
                            <span className="text-xs text-text-muted">{formLabels.fpsLabel}</span>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={fps}
                              onChange={(event) => setFps(event.target.value)}
                              className={fieldClass}
                            />
                          </label>
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
                            onChange={(event) => setNumInferenceSteps(event.target.value)}
                            className={fieldClass}
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block space-y-1.5">
                            <span className="text-xs text-text-muted">
                              {formLabels.guidanceScaleLabel}
                            </span>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={guidanceScale}
                              onChange={(event) => setGuidanceScale(event.target.value)}
                              className={fieldClass}
                            />
                          </label>

                          <label className="block space-y-1.5">
                            <span className="text-xs text-text-muted">
                              {formLabels.guidanceScale2Label}
                            </span>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={guidanceScale2}
                              onChange={(event) => setGuidanceScale2(event.target.value)}
                              className={fieldClass}
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block space-y-1.5">
                            <span className="text-xs text-text-muted">
                              {formLabels.boundaryRatioLabel}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.001}
                              value={boundaryRatio}
                              onChange={(event) => setBoundaryRatio(event.target.value)}
                              className={fieldClass}
                            />
                          </label>

                          <label className="block space-y-1.5">
                            <span className="text-xs text-text-muted">
                              {formLabels.flowShiftLabel}
                            </span>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={flowShift}
                              onChange={(event) => setFlowShift(event.target.value)}
                              className={fieldClass}
                            />
                          </label>
                        </div>

                        <label className="block space-y-1.5">
                          <span className="text-xs text-text-muted">{formLabels.seedLabel}</span>
                          <input
                            type="number"
                            value={seed}
                            onChange={(event) => setSeed(event.target.value)}
                            className={fieldClass}
                          />
                        </label>
                      </>
                    )}
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
                          <video
                            src={toVideoSrc(videoB64)}
                            controls
                            playsInline
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
                    {i18n.videoTestConfirm}
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
