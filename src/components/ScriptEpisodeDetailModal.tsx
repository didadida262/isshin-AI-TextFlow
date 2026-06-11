import { type ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faClock,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ProjectAssetRecord } from "../services/assets";
import type { ScriptRecord } from "../services/script";
import { SCRIPT_STATE_ERROR } from "../services/script";
import {
  getVideoStatusKind,
  resolveVideoErrorMessage,
  type LatestVideoJobInfo,
} from "../utils/videoStatus";
import { MarkdownContent } from "./MarkdownContent";
import { ModalPortal } from "./ModalPortal";

interface ScriptEpisodeDetailModalVideoLabels {
  colVideo: string;
  colVideoStatus: string;
  colPrompt: string;
  colErrorReason: string;
  noVideo: string;
  noPrompt: string;
  formatDuration: (ms: number) => string;
  statusSuccess: string;
  statusError: string;
  statusPending: string;
  statusGenerating: string;
}

const videoStatusBadgeClass = {
  success:
    "border-accent/35 bg-accent/10 text-accent shadow-[0_0_10px_rgba(0,255,102,0.15)]",
  error: "border-red-500/35 bg-red-500/10 text-red-400",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  generating: "border-sky-400/35 bg-sky-400/10 text-sky-300",
} as const;

function VideoStatusBadge({
  kind,
  labels,
}: {
  kind: ReturnType<typeof getVideoStatusKind>;
  labels: {
    statusSuccess: string;
    statusError: string;
    statusPending: string;
    statusGenerating: string;
  };
}) {
  const label =
    kind === "error"
      ? labels.statusError
      : kind === "success"
        ? labels.statusSuccess
        : kind === "generating"
          ? labels.statusGenerating
          : labels.statusPending;
  const icon =
    kind === "error"
      ? faCircleExclamation
      : kind === "success"
        ? faCircleCheck
        : kind === "generating"
          ? faSpinner
          : faClock;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${videoStatusBadgeClass[kind]}`}
    >
      <FontAwesomeIcon
        icon={icon}
        className={`text-base ${kind === "generating" ? "animate-spin" : ""}`}
      />
      {label}
    </span>
  );
}

function resolveEpisodeVideoPrompt(
  script: ScriptRecord,
  video?: ProjectAssetRecord | null,
): string {
  const draft = script.videoPrompt?.trim();
  if (draft) return draft;
  return video?.prompt?.trim() ?? "";
}

interface ScriptEpisodeDetailModalProps {
  script: ScriptRecord | null;
  video?: ProjectAssetRecord | null;
  videoJob?: LatestVideoJobInfo;
  videoLabels?: ScriptEpisodeDetailModalVideoLabels;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0">
      <dt className="mb-1.5 text-xs font-medium text-text-muted">{label}</dt>
      <dd className="text-sm leading-relaxed text-white">{children}</dd>
    </div>
  );
}

type ScriptStatusKind = "success" | "error" | "pending";

function getScriptStatusKind(script: ScriptRecord): ScriptStatusKind {
  if (script.scriptState === SCRIPT_STATE_ERROR) return "error";
  if (script.content.trim()) return "success";
  return "pending";
}

const statusBadgeClass: Record<ScriptStatusKind, string> = {
  success:
    "border-accent/35 bg-accent/10 text-accent shadow-[0_0_14px_rgba(0,255,102,0.2)]",
  error: "border-red-500/35 bg-red-500/10 text-red-400",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
};

const statusIconClass: Record<ScriptStatusKind, string> = {
  success: "text-accent",
  error: "text-red-400",
  pending: "text-amber-300",
};

function ScriptStatusBadge({
  script,
  labels,
}: {
  script: ScriptRecord;
  labels: {
    statusSuccess: string;
    statusError: string;
    statusPending: string;
  };
}) {
  const kind = getScriptStatusKind(script);
  const label =
    kind === "error"
      ? labels.statusError
      : kind === "success"
        ? labels.statusSuccess
        : labels.statusPending;
  const icon =
    kind === "error"
      ? faCircleExclamation
      : kind === "success"
        ? faCircleCheck
        : faClock;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${statusBadgeClass[kind]}`}
    >
      <FontAwesomeIcon icon={icon} className={`text-base ${statusIconClass[kind]}`} />
      {label}
    </span>
  );
}

export function ScriptEpisodeDetailModal({
  script,
  video,
  videoJob,
  videoLabels,
  onClose,
}: ScriptEpisodeDetailModalProps) {
  const i18n = useTranslationMessages();
  const s = i18n.creation.aiScriptStep;
  const promptText = script
    ? resolveEpisodeVideoPrompt(script, video)
    : "";
  const videoStatusKind = getVideoStatusKind(video, videoJob?.status);
  const videoErrorMessage = resolveVideoErrorMessage(video, videoJob);

  return (
    <ModalPortal>
      <AnimatePresence>
        {script ? (
          <motion.div
            key={`script-detail-${script.id}`}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={i18n.creation.cancel}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="script-episode-detail-title"
              className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-surface shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                <h3
                  id="script-episode-detail-title"
                  className="min-w-0 text-base font-semibold text-white"
                >
                  {s.scriptDetailTitle(script.episodeIndex, script.name)}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/10 hover:text-white"
                  aria-label={i18n.creation.cancel}
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <dl className="space-y-5">
                  <DetailField label={s.colEpisode}>
                    {script.episodeIndex}
                  </DetailField>
                  <DetailField label={s.colName}>{script.name}</DetailField>
                  <DetailField label={s.colStatus}>
                    <ScriptStatusBadge script={script} labels={s} />
                  </DetailField>
                  {videoLabels ? (
                    <>
                      <DetailField label={videoLabels.colVideoStatus}>
                        <VideoStatusBadge
                          kind={videoStatusKind}
                          labels={videoLabels}
                        />
                      </DetailField>
                      {videoStatusKind === "error" && videoErrorMessage ? (
                        <DetailField label={videoLabels.colErrorReason}>
                          <p className="whitespace-pre-wrap break-words text-red-400">
                            {videoErrorMessage}
                          </p>
                        </DetailField>
                      ) : null}
                      <DetailField label={videoLabels.colPrompt}>
                        {promptText ? (
                          <p className="whitespace-pre-wrap break-words text-text-muted">
                            {promptText}
                          </p>
                        ) : (
                          <span className="text-text-muted">
                            {videoLabels.noPrompt}
                          </span>
                        )}
                      </DetailField>
                    </>
                  ) : null}
                  {videoLabels ? (
                    <DetailField label={videoLabels.colVideo}>
                      {video?.imagePath ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center rounded-lg border border-white/10 bg-black/30 p-3">
                            <video
                              src={convertFileSrc(video.imagePath)}
                              controls
                              playsInline
                              className="max-h-[min(40vh,360px)] w-auto max-w-full rounded-md object-contain"
                            />
                          </div>
                          {video.generationDurationMs != null ? (
                            <p className="text-xs text-text-muted">
                              {videoLabels.formatDuration(
                                video.generationDurationMs,
                              )}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-text-muted">
                          {videoLabels.noVideo}
                        </span>
                      )}
                    </DetailField>
                  ) : null}
                  {script.scriptState === SCRIPT_STATE_ERROR ? (
                    <DetailField label={s.colErrorReason}>
                      <p className="whitespace-pre-wrap break-words text-red-400">
                        {script.errorReason ?? s.statusError}
                      </p>
                    </DetailField>
                  ) : (
                    <DetailField label={s.colContent}>
                      {script.content ? (
                        <div className="text-text-muted">
                          <MarkdownContent content={script.content} />
                        </div>
                      ) : (
                        <span className="text-text-muted">{s.noContent}</span>
                      )}
                    </DetailField>
                  )}
                </dl>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
