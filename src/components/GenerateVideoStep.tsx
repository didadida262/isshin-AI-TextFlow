import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  ASSET_STATE_ERROR,
  createProjectAsset,
  type ProjectAssetRecord,
} from "../services/assets";
import {
  SCRIPT_STATE_ERROR,
  SCRIPT_STATE_SUCCESS,
  type ScriptRecord,
} from "../services/script";
import type { CreationProject } from "../types";
import { ScriptEpisodeDetailModal } from "./ScriptEpisodeDetailModal";
import {
  TextToVideoModal,
  type TextToVideoFormValues,
} from "./TextToVideoModal";

interface GenerateVideoStepProps {
  project: CreationProject;
  title: string;
  scripts: ScriptRecord[];
  initialVideos: ProjectAssetRecord[];
  onConfigError: (message: string | null) => void;
  onVideosUpdated?: () => void;
}

function buildLatestVideoMap(
  videos: ProjectAssetRecord[],
): Map<string, ProjectAssetRecord> {
  const map = new Map<string, ProjectAssetRecord>();
  for (const video of videos) {
    if (video.assetType !== "video") continue;
    const existing = map.get(video.name);
    if (!existing || video.createdAt > existing.createdAt) {
      map.set(video.name, video);
    }
  }
  return map;
}

function canGenerateVideo(script: ScriptRecord): boolean {
  return (
    script.scriptState === SCRIPT_STATE_SUCCESS &&
    Boolean(script.content.trim())
  );
}

function canViewDetail(script: ScriptRecord): boolean {
  return (
    script.scriptState === SCRIPT_STATE_ERROR ||
    Boolean(script.content.trim())
  );
}

function previewText(script: ScriptRecord, noContent: string): string {
  if (script.scriptState === SCRIPT_STATE_ERROR) {
    return script.errorReason ?? noContent;
  }
  if (script.content) {
    return script.content.replace(/\s+/g, " ").trim();
  }
  return noContent;
}

function scriptStatusLabel(
  script: ScriptRecord,
  labels: {
    statusSuccess: string;
    statusError: string;
    statusPending: string;
  },
): string {
  if (script.scriptState === SCRIPT_STATE_SUCCESS) return labels.statusSuccess;
  if (script.scriptState === SCRIPT_STATE_ERROR) return labels.statusError;
  return labels.statusPending;
}

function scriptStatusClass(script: ScriptRecord): string {
  if (script.scriptState === SCRIPT_STATE_SUCCESS) return "text-accent";
  if (script.scriptState === SCRIPT_STATE_ERROR) return "text-red-400";
  return "text-text-dim";
}

type VideoStatusKind = "success" | "error" | "pending";

function getVideoStatusKind(
  video: ProjectAssetRecord | undefined,
): VideoStatusKind {
  if (!video) return "pending";
  if (video.assetState === ASSET_STATE_ERROR) return "error";
  if (video.imagePath) return "success";
  return "pending";
}

const videoStatusBadgeClass: Record<VideoStatusKind, string> = {
  success:
    "border-accent/35 bg-accent/10 text-accent shadow-[0_0_10px_rgba(0,255,102,0.15)]",
  error: "border-red-500/35 bg-red-500/10 text-red-400",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
};

function VideoStatusBadge({
  kind,
  labels,
}: {
  kind: VideoStatusKind;
  labels: {
    statusSuccess: string;
    statusError: string;
    statusPending: string;
  };
}) {
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${videoStatusBadgeClass[kind]}`}
    >
      <FontAwesomeIcon icon={icon} className="text-sm" />
      {label}
    </span>
  );
}

export function GenerateVideoStep({
  project,
  title,
  scripts,
  initialVideos,
  onConfigError,
  onVideosUpdated,
}: GenerateVideoStepProps) {
  const s = useTranslationMessages().creation.generateVideoStep;
  const [videos, setVideos] = useState(initialVideos);
  const [videoScript, setVideoScript] = useState<ScriptRecord | null>(null);
  const [detailScript, setDetailScript] = useState<ScriptRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  const videoMap = useMemo(() => buildLatestVideoMap(videos), [videos]);

  const sorted = [...scripts].sort((a, b) => a.episodeIndex - b.episodeIndex);
  const hasScripts = sorted.length > 0;

  const openVideoModal = useCallback((script: ScriptRecord) => {
    setVideoScript(script);
    setModalOpen(true);
  }, []);

  const closeVideoModal = useCallback(() => {
    setModalOpen(false);
    setVideoScript(null);
  }, []);

  const handleCreateVideo = useCallback(
    async (values: TextToVideoFormValues, videoB64: string) => {
      onConfigError(null);
      const saved = await createProjectAsset({
        projectId: project.id,
        name: values.name,
        assetType: "video",
        prompt: values.prompt,
        model: values.model,
        size: values.size,
        videoB64,
        generationDurationMs: values.generationDurationMs,
        numInferenceSteps: values.numInferenceSteps,
      });

      setVideos((prev) => [
        saved,
        ...prev.filter((item) => item.name !== saved.name),
      ]);
      if (videoScript) {
        setDetailScript(videoScript);
      }
      closeVideoModal();
      onVideosUpdated?.();
    },
    [closeVideoModal, onConfigError, onVideosUpdated, project.id, videoScript],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="step-panel-title w-fit shrink-0 self-start">{title}</h2>

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-surface/20">
        {hasScripts ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-40 sm:w-48" />
                <col className="w-20" />
                <col />
                <col className="w-24" />
                <col className="w-28 sm:w-32" />
                <col className="w-28 sm:w-32" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
                <tr className="border-b border-white/10 text-text-muted">
                  <th className="px-3 py-2.5 font-medium">{s.colEpisode}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colName}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colStatus}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colContent}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colDuration}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colVideoStatus}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((script) => {
                  const video = videoMap.get(script.name);
                  const hasVideo = Boolean(video?.imagePath);
                  const generateEnabled = canGenerateVideo(script);
                  const detailEnabled = canViewDetail(script);
                  const contentPreview = previewText(script, s.noContent);

                  return (
                    <tr
                      key={script.id}
                      onClick={() => {
                        if (detailEnabled) setDetailScript(script);
                      }}
                      className={`border-b border-white/5 align-top transition ${
                        detailEnabled
                          ? "cursor-pointer hover:bg-white/[0.02]"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 text-text-muted">
                        {script.episodeIndex}
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-white">
                        <p className="truncate" title={script.name}>
                          {script.name}
                        </p>
                      </td>
                      <td className={`px-3 py-2.5 ${scriptStatusClass(script)}`}>
                        {scriptStatusLabel(script, s)}
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-text-muted">
                        <p className="truncate" title={contentPreview}>
                          {contentPreview}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-text-muted">
                        {video?.generationDurationMs != null
                          ? s.formatDuration(video.generationDurationMs)
                          : s.noContent}
                      </td>
                      <td className="px-3 py-2.5">
                        <VideoStatusBadge
                          kind={getVideoStatusKind(video)}
                          labels={s}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          disabled={!generateEnabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            openVideoModal(script);
                          }}
                          className="text-xs text-accent transition hover:underline disabled:cursor-not-allowed disabled:text-text-dim disabled:no-underline"
                        >
                          {hasVideo ? s.regenerateVideo : s.generateVideo}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
              {s.emptyHint}
            </p>
          </div>
        )}
      </div>

      <TextToVideoModal
        open={modalOpen}
        initialName={videoScript?.name ?? ""}
        initialPrompt={videoScript?.content ?? ""}
        onClose={closeVideoModal}
        onSubmit={handleCreateVideo}
      />

      <ScriptEpisodeDetailModal
        script={detailScript}
        video={
          detailScript ? (videoMap.get(detailScript.name) ?? null) : undefined
        }
        videoLabels={s}
        onClose={() => setDetailScript(null)}
      />
    </div>
  );
}
