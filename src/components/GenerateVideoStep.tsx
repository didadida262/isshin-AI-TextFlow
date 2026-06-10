import { useCallback, useEffect, useMemo, useState } from "react";
import { useGenerationJobs } from "../contexts/GenerationJobsContext";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faClock,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { generateVideoPromptsWithAgent } from "../agents/workflowAgent/videoPromptGeneration";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  ASSET_STATE_ERROR,
  type ProjectAssetRecord,
} from "../services/assets";
import {
  SCRIPT_STATE_ERROR,
  SCRIPT_STATE_SUCCESS,
  setScriptVideoPrompt,
  type ScriptRecord,
} from "../services/script";
import {
  getVideoSettingsFromConfig,
  isVideoSettingsValid,
} from "../services/config";
import { buildDefaultVideoJobValues } from "../services/videoGeneration";
import type { AppConfig, CreationProject } from "../types";
import { ScriptEpisodeDetailModal } from "./ScriptEpisodeDetailModal";
import { VideoPromptEditModal } from "./VideoPromptEditModal";
import { VideoScriptRowActions } from "./VideoScriptRowActions";
import { VideoThumbnail } from "./VideoThumbnail";

interface GenerateVideoStepProps {
  project: CreationProject;
  title: string;
  config: AppConfig;
  selectedModel: string;
  scripts: ScriptRecord[];
  initialVideos: ProjectAssetRecord[];
  onConfigError: (message: string | null) => void;
  onVideosUpdated?: () => void;
  onScriptsUpdated?: () => void;
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

function resolveEpisodeVideoPrompt(
  script: ScriptRecord,
  video?: ProjectAssetRecord | null,
): string {
  const draft = script.videoPrompt?.trim();
  if (draft) return draft;
  return video?.prompt?.trim() ?? "";
}

function episodePromptPreview(
  script: ScriptRecord,
  video: ProjectAssetRecord | undefined,
  noPrompt: string,
): string {
  const prompt = resolveEpisodeVideoPrompt(script, video);
  if (!prompt) return noPrompt;
  return prompt.replace(/\s+/g, " ").trim();
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

function PromptLoadingCell({ label }: { label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-text-muted">
      <FontAwesomeIcon
        icon={faSpinner}
        className="shrink-0 text-xs text-accent animate-spin"
      />
      <span className="truncate">{label}</span>
    </span>
  );
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
  config,
  selectedModel,
  scripts,
  initialVideos,
  onConfigError,
  onVideosUpdated,
  onScriptsUpdated,
}: GenerateVideoStepProps) {
  const { creation, errors } = useTranslationMessages();
  const s = creation.generateVideoStep;
  const [localScripts, setLocalScripts] = useState(scripts);
  const [videos, setVideos] = useState(initialVideos);
  const [detailScript, setDetailScript] = useState<ScriptRecord | null>(null);
  const [editScript, setEditScript] = useState<ScriptRecord | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [openMenuScriptId, setOpenMenuScriptId] = useState<number | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [promptProgress, setPromptProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [promptGeneratingIds, setPromptGeneratingIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const { startVideoJob, navigationTarget, clearNavigationTarget } =
    useGenerationJobs();

  useEffect(() => {
    setLocalScripts(scripts);
  }, [scripts]);

  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  const videoMap = useMemo(() => buildLatestVideoMap(videos), [videos]);

  useEffect(() => {
    if (
      !navigationTarget ||
      navigationTarget.projectId !== project.id ||
      navigationTarget.stepId !== "generateVideo" ||
      !navigationTarget.scriptName
    ) {
      return;
    }

    const script = localScripts.find(
      (item) => item.name === navigationTarget.scriptName,
    );
    if (!script) {
      clearNavigationTarget();
      return;
    }

    if (navigationTarget.assetId != null) {
      const video = videoMap.get(script.name);
      if (!video || video.id !== navigationTarget.assetId) {
        return;
      }
    }

    setDetailScript(script);
    clearNavigationTarget();
  }, [
    clearNavigationTarget,
    navigationTarget,
    project.id,
    localScripts,
    videoMap,
  ]);

  const sorted = [...localScripts].sort((a, b) => a.episodeIndex - b.episodeIndex);
  const hasScripts = sorted.length > 0;

  const successfulScripts = useMemo(
    () =>
      sorted.filter(
        (script) =>
          script.scriptState === SCRIPT_STATE_SUCCESS && script.content.trim(),
      ),
    [sorted],
  );

  const validatePromptConfig = useCallback((): string | null => {
    if (!config.baseUrl.trim() || !config.apiKey.trim()) {
      return s.configRequired;
    }
    const model = selectedModel.trim() || config.models[0]?.trim() || "";
    if (!model) return s.modelRequired;
    return null;
  }, [
    config.apiKey,
    config.baseUrl,
    config.models,
    s.configRequired,
    s.modelRequired,
    selectedModel,
  ]);

  const handleBatchGeneratePrompts = useCallback(async () => {
    if (batchGenerating) return;

    const configError = validatePromptConfig();
    if (configError) {
      setActionError(configError);
      setActionNotice(null);
      onConfigError(configError);
      return;
    }

    if (successfulScripts.length === 0) {
      setActionError(s.noScriptsToGeneratePrompts);
      setActionNotice(null);
      return;
    }

    const model = selectedModel.trim() || config.models[0]?.trim() || "";
    setBatchGenerating(true);
    setPromptProgress(null);
    setPromptGeneratingIds(new Set(successfulScripts.map((script) => script.id)));
    setActionError(null);
    setActionNotice(null);
    onConfigError(null);

    try {
      await generateVideoPromptsWithAgent({
        config,
        model,
        scripts: localScripts,
        onProgress: setPromptProgress,
        onScriptPromptSaved: (saved) => {
          setLocalScripts((current) =>
            current.map((item) =>
              item.id === saved.id ? { ...item, videoPrompt: saved.videoPrompt } : item,
            ),
          );
          setPromptGeneratingIds((current) => {
            const next = new Set(current);
            next.delete(saved.id);
            return next;
          });
        },
      });
      setActionNotice(s.batchGeneratePromptsComplete);
      onScriptsUpdated?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      setActionError(message);
      onConfigError(message);
    } finally {
      setBatchGenerating(false);
      setPromptProgress(null);
      setPromptGeneratingIds(new Set());
    }
  }, [
    batchGenerating,
    config,
    localScripts,
    onConfigError,
    onScriptsUpdated,
    s.batchGeneratePromptsComplete,
    s.noScriptsToGeneratePrompts,
    selectedModel,
    successfulScripts.length,
    validatePromptConfig,
  ]);

  const validateVideoConfig = useCallback((): string | null => {
    if (!isVideoSettingsValid(getVideoSettingsFromConfig(config))) {
      return errors.videoConfigRequired;
    }
    return null;
  }, [config, errors.videoConfigRequired]);

  const handleGenerateVideo = useCallback(
    (script: ScriptRecord) => {
      const video = videoMap.get(script.name);
      const prompt = resolveEpisodeVideoPrompt(script, video);
      if (!prompt) {
        setActionError(s.noPromptToGenerate);
        setActionNotice(null);
        return;
      }

      const configError = validateVideoConfig();
      if (configError) {
        setActionError(configError);
        setActionNotice(null);
        onConfigError(configError);
        return;
      }

      setActionError(null);
      setActionNotice(null);
      onConfigError(null);

      startVideoJob({
        projectId: project.id,
        projectName: project.name,
        values: buildDefaultVideoJobValues(script.name, prompt, config),
        onWorkflowChange: onVideosUpdated,
      });
    },
    [
      config,
      onConfigError,
      onVideosUpdated,
      project.id,
      project.name,
      s.noPromptToGenerate,
      startVideoJob,
      validateVideoConfig,
      videoMap,
    ],
  );

  const handleSaveVideoPrompt = useCallback(
    async (videoPrompt: string) => {
      if (!editScript || savingPrompt) return;

      setSavingPrompt(true);
      setActionError(null);

      try {
        const saved = await setScriptVideoPrompt({
          projectId: editScript.projectId,
          episodeIndex: editScript.episodeIndex,
          videoPrompt,
        });

        setLocalScripts((current) =>
          current.map((item) =>
            item.id === saved.id
              ? { ...item, videoPrompt: saved.videoPrompt }
              : item,
          ),
        );
        setEditScript(null);
        onScriptsUpdated?.();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : s.savePromptFailed;
        setActionError(message);
      } finally {
        setSavingPrompt(false);
      }
    },
    [editScript, onScriptsUpdated, s.savePromptFailed, savingPrompt],
  );

  const canBatchGeneratePrompts =
    !batchGenerating && successfulScripts.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h2 className="step-panel-title w-fit min-w-0 shrink self-start">{title}</h2>
        {hasScripts ? (
          <button
            type="button"
            onClick={() => void handleBatchGeneratePrompts()}
            disabled={!canBatchGeneratePrompts}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {batchGenerating ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                {promptProgress
                  ? s.batchGeneratingPromptsProgress(
                      promptProgress.completed,
                      promptProgress.total,
                    )
                  : s.batchGeneratingPrompts}
              </>
            ) : (
              s.batchGeneratePrompts
            )}
          </button>
        ) : null}
      </div>

      {actionError ? (
        <p className="mt-3 shrink-0 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      ) : actionNotice ? (
        <p className="mt-3 shrink-0 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-sm text-accent">
          {actionNotice}
        </p>
      ) : null}

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-surface/20">
        {hasScripts ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-32 sm:w-36" />
                <col className="w-20" />
                <col className="w-48 sm:w-56" />
                <col className="w-24" />
                <col className="w-20" />
                <col className="w-28" />
                <col className="w-14" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
                <tr className="border-b border-white/10 text-text-muted">
                  <th className="px-3 py-2.5 font-medium">{s.colEpisode}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colName}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colStatus}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colPrompt}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colVideo}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colDuration}</th>
                  <th className="px-3 py-2.5 font-medium">{s.colVideoStatus}</th>
                  <th className="w-14 px-2 py-2.5 text-center font-medium">
                    {s.colActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((script) => {
                  const video = videoMap.get(script.name);
                  const hasVideo = Boolean(video?.imagePath);
                  const generateEnabled = canGenerateVideo(script);
                  const hasPrompt = Boolean(
                    resolveEpisodeVideoPrompt(script, video),
                  );
                  const generateVideoEnabled = generateEnabled && hasPrompt;
                  const detailEnabled = canViewDetail(script);
                  const isPromptGenerating = promptGeneratingIds.has(script.id);
                  const promptPreview = episodePromptPreview(
                    script,
                    video,
                    s.noPrompt,
                  );

                  return (
                    <tr
                      key={script.id}
                      onClick={() => {
                        if (detailEnabled) setDetailScript(script);
                      }}
                      className={`border-b border-white/5 align-middle transition ${
                        detailEnabled
                          ? "cursor-pointer hover:bg-white/[0.02]"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 text-text-muted">
                        {script.episodeIndex}
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-white">
                        <p className="truncate">{script.name}</p>
                      </td>
                      <td className={`px-3 py-2.5 ${scriptStatusClass(script)}`}>
                        {scriptStatusLabel(script, s)}
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-text-muted">
                        {isPromptGenerating ? (
                          <PromptLoadingCell label={s.generatingPrompt} />
                        ) : (
                          <p
                            className="line-clamp-2 break-words"
                            title={promptPreview}
                          >
                            {promptPreview}
                          </p>
                        )}
                      </td>
                      <td className="max-w-0 px-3 py-2.5">
                        {video?.imagePath ? (
                          <span className="block overflow-hidden rounded-md border border-sky-400/20 bg-sky-400/10">
                            <VideoThumbnail
                              src={convertFileSrc(video.imagePath)}
                              alt={script.name}
                            />
                          </span>
                        ) : (
                          <span className="block truncate whitespace-nowrap text-text-dim">
                            {s.noVideo}
                          </span>
                        )}
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
                      <td
                        className="w-14 px-2 py-2.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-center">
                          <VideoScriptRowActions
                            openMenuLabel={s.openActionsMenu}
                            editLabel={s.edit}
                            generateLabel={
                              hasVideo ? s.regenerateVideo : s.generateVideo
                            }
                            editDisabled={!generateEnabled}
                            generateDisabled={!generateVideoEnabled}
                            isOpen={openMenuScriptId === script.id}
                            onToggle={() =>
                              setOpenMenuScriptId((current) =>
                                current === script.id ? null : script.id,
                              )
                            }
                            onClose={() => setOpenMenuScriptId(null)}
                            onEdit={() => setEditScript(script)}
                            onGenerate={() => handleGenerateVideo(script)}
                          />
                        </div>
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

      <ScriptEpisodeDetailModal
        script={detailScript}
        video={
          detailScript ? (videoMap.get(detailScript.name) ?? null) : undefined
        }
        videoLabels={s}
        onClose={() => setDetailScript(null)}
      />

      <VideoPromptEditModal
        script={editScript}
        video={
          editScript ? (videoMap.get(editScript.name) ?? null) : undefined
        }
        saving={savingPrompt}
        onClose={() => {
          if (savingPrompt) return;
          setEditScript(null);
        }}
        onSave={handleSaveVideoPrompt}
      />
    </div>
  );
}
