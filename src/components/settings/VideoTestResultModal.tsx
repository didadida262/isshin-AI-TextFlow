import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../../contexts/I18nContext";
import type { VideoGenerationSettings } from "../../services/config";
import {
  VIDEO_TEST_PROMPT,
  testVideoConnection,
} from "../../services/videoGeneration";
import { ModalPortal } from "../ModalPortal";
import { PaintbrushLoading } from "../PaintbrushLoading";

interface VideoTestResultModalProps {
  open: boolean;
  settings: VideoGenerationSettings | null;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

type TestPhase = "generating" | "success" | "error";

function toVideoSrc(b64: string): string {
  const cleaned = b64.trim().replace(/^data:video\/mp4;base64,/, "");
  return `data:video/mp4;base64,${cleaned}`;
}

export function VideoTestResultModal({
  open,
  settings,
  onClose,
}: VideoTestResultModalProps) {
  const i18n = useTranslationMessages();
  const errors = useTranslationMessages().errors;
  const videoLabels = useTranslationMessages().creation.textToVideoModal;
  const [phase, setPhase] = useState<TestPhase>("generating");
  const [videoB64, setVideoB64] = useState("");
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const runTest = useCallback(() => {
    if (!settings) return;

    const requestId = ++requestIdRef.current;
    setPhase("generating");
    setVideoB64("");
    setError("");

    void testVideoConnection(settings, VIDEO_TEST_PROMPT)
      .then((b64) => {
        if (requestId !== requestIdRef.current) return;
        setVideoB64(b64);
        setPhase("success");
      })
      .catch((testError) => {
        if (requestId !== requestIdRef.current) return;
        const message =
          testError instanceof Error ? testError.message : String(testError);
        setError(
          message === "VIDEO_CONFIG_REQUIRED"
            ? errors.videoConfigRequired
            : message,
        );
        setPhase("error");
      });
  }, [errors.videoConfigRequired, settings]);

  useEffect(() => {
    if (!open || !settings) return;
    runTest();
  }, [open, runTest, settings]);

  const generating = phase === "generating";

  const handleClose = () => {
    requestIdRef.current += 1;
    onClose();
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && settings ? (
          <motion.div
            key="video-test-result-modal"
            className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="video-test-title"
              className={`pointer-events-auto relative z-10 flex max-h-[min(560px,calc(100dvh-7rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-surface shadow-2xl ${
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
                  {i18n.settings.videoTestTitle}
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  {generating ? (
                    <div
                      className="flex min-h-[240px] items-center justify-center rounded-lg border border-white/10 bg-black/30 p-6"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <PaintbrushLoading label={videoLabels.generating} />
                    </div>
                  ) : null}

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
                      <p className="flex items-center justify-center gap-2 text-sm text-accent">
                        <FontAwesomeIcon icon={faCircleCheck} />
                        {i18n.settings.connectionOk}
                      </p>
                    </>
                  ) : null}

                  {phase === "error" ? (
                    <p className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 shrink-0" />
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
