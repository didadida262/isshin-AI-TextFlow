import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faCircleCheck,
  faCircleExclamation,
  faEye,
  faEyeSlash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { AppConfig } from "../../types";
import { useI18n, useTranslationMessages } from "../../contexts/I18nContext";
import { formatDurationMs } from "../../utils/formatDuration";
import { testConnection } from "../../services/chat";
import {
  isImageSettingsValid,
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_SIZE,
  getImageToVideoSettingsFromConfig,
  getPromptRefineSettingsFromConfig,
  getVideoSettingsFromConfig,
  isImageToVideoSettingsValid,
  isKuaiziVideoApi,
  isPromptRefineSettingsValid,
  isVideoSettingsValid,
  KUAIZI_VIDEO_API_URL,
} from "../../services/config";
import { ImageTestResultModal } from "./ImageTestResultModal";
import { ImageToVideoTestResultModal } from "./ImageToVideoTestResultModal";
import { PromptRefineTestResultModal } from "./PromptRefineTestResultModal";
import { VideoTestResultModal } from "./VideoTestResultModal";

interface ModelServiceSettingsPanelProps {
  draft: AppConfig;
  selectedModel: string;
  onDraftChange: (updater: (current: AppConfig) => AppConfig) => void;
  onSelectModel: (model: string) => void;
  onSyncModels: (apiKey: string) => Promise<void>;
  modelsStatus: "idle" | "loading" | "ok" | "error";
  modelsError: string;
}

export function ModelServiceSettingsPanel({
  draft,
  selectedModel,
  onDraftChange,
  onSelectModel,
  onSyncModels,
  modelsStatus,
  modelsError,
}: ModelServiceSettingsPanelProps) {
  const { t, locale } = useI18n();
  const i18n = useTranslationMessages();
  const [showKey, setShowKey] = useState(false);
  const [showImageKey, setShowImageKey] = useState(false);
  const [showVideoKey, setShowVideoKey] = useState(false);
  const [showImageToVideoKey, setShowImageToVideoKey] = useState(false);
  const [showPromptRefineKey, setShowPromptRefineKey] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [testError, setTestError] = useState("");
  const [testElapsedMs, setTestElapsedMs] = useState<number | null>(null);
  const [promptRefineTestOpen, setPromptRefineTestOpen] = useState(false);
  const [imageTestOpen, setImageTestOpen] = useState(false);
  const [videoTestOpen, setVideoTestOpen] = useState(false);
  const [imageToVideoTestOpen, setImageToVideoTestOpen] = useState(false);

  const imageSettings = {
    imageApiUrl: draft.imageApiUrl,
    imageApiKey: draft.imageApiKey,
    imageModel: draft.imageModel,
    imageDefaultSize: DEFAULT_IMAGE_SIZE,
    imageCount: DEFAULT_IMAGE_COUNT,
  };

  const videoSettings = getVideoSettingsFromConfig(draft);
  const imageToVideoSettings = getImageToVideoSettingsFromConfig(draft);
  const promptRefineSettings = getPromptRefineSettingsFromConfig(draft);

  const readOnlyFieldClass =
    "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-text-muted outline-none read-only:cursor-default";

  useEffect(() => {
    setTestStatus("idle");
    setTestError("");
    setTestElapsedMs(null);
  }, [selectedModel]);

  const removeModel = (id: string) => {
    const remaining = draft.models.filter((model) => model !== id);
    onDraftChange((current) => ({
      ...current,
      models: current.models.filter((model) => model !== id),
    }));
    if (id === selectedModel) {
      onSelectModel(remaining[0] ?? "");
    }
  };

  const runTest = async () => {
    if (!selectedModel) return;
    setTestStatus("loading");
    setTestError("");
    setTestElapsedMs(null);
    const startedAt = performance.now();
    try {
      await testConnection(draft, selectedModel);
      setTestElapsedMs(Math.max(0, Math.round(performance.now() - startedAt)));
      setTestStatus("ok");
    } catch (error) {
      setTestElapsedMs(Math.max(0, Math.round(performance.now() - startedAt)));
      setTestStatus("error");
      setTestError(error instanceof Error ? error.message : String(error));
    }
  };

  const canTestConnection =
    Boolean(selectedModel) &&
    draft.models.includes(selectedModel) &&
    draft.apiKey.trim() &&
    draft.baseUrl.trim();

  const canTestImageConnection = isImageSettingsValid(imageSettings);

  const runImageTest = () => {
    if (!canTestImageConnection || imageTestOpen) return;
    setImageTestOpen(true);
  };

  const canTestVideoConnection = isVideoSettingsValid(videoSettings);

  const runVideoTest = () => {
    if (!canTestVideoConnection || videoTestOpen) return;
    setVideoTestOpen(true);
  };

  const canTestImageToVideoConnection =
    isImageToVideoSettingsValid(imageToVideoSettings);

  const runImageToVideoTest = () => {
    if (!canTestImageToVideoConnection || imageToVideoTestOpen) return;
    setImageToVideoTestOpen(true);
  };

  const canTestPromptRefineConnection =
    isPromptRefineSettingsValid(promptRefineSettings);

  const runPromptRefineTest = () => {
    if (!canTestPromptRefineConnection || promptRefineTestOpen) return;
    setPromptRefineTestOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white">
          {i18n.settings.generalApiSection}
        </h3>

      <label className="block space-y-2">
        <span className="text-sm text-text-muted">{i18n.settings.baseUrl}</span>
        <input
          type="url"
          value={draft.baseUrl}
          onChange={(event) =>
            onDraftChange((current) => ({ ...current, baseUrl: event.target.value }))
          }
          placeholder="https://aiplatform.njsrd.com/llm/v1"
          className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent/50"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm text-text-muted">{i18n.settings.apiKey}</span>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={draft.apiKey}
            onChange={(event) =>
              onDraftChange((current) => ({ ...current, apiKey: event.target.value }))
            }
            placeholder="sk-..."
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 pr-10 text-sm outline-none focus:border-accent/50"
          />
          <button
            type="button"
            onClick={() => setShowKey((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
          >
            <FontAwesomeIcon icon={showKey ? faEyeSlash : faEye} />
          </button>
        </div>
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-text-muted">{i18n.settings.models}</span>
          <button
            type="button"
            onClick={() => void onSyncModels(draft.apiKey)}
            disabled={modelsStatus === "loading" || !draft.apiKey.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-xs text-text-muted transition hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faArrowsRotate} spin={modelsStatus === "loading"} />
            {modelsStatus === "loading"
              ? i18n.settings.refreshing
              : i18n.settings.refresh}
          </button>
        </div>
        <p className="text-xs text-text-dim">
          {i18n.settings.syncHint}
          aiplatform.njsrd.com/nexus/api/api-keys/models
        </p>
        {modelsStatus === "ok" && draft.models.length > 0 ? (
          <p className="flex items-center gap-2 text-xs text-accent">
            <FontAwesomeIcon icon={faCircleCheck} />
            {t("settings.modelsLoaded", { count: draft.models.length })}
          </p>
        ) : null}
        {modelsStatus === "error" ? (
          <p className="flex items-start gap-2 text-xs text-red-400">
            <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 shrink-0" />
            {modelsError}
          </p>
        ) : null}
        {modelsStatus === "loading" && draft.models.length === 0 ? (
          <p className="text-xs text-text-muted">{i18n.settings.fetchingModels}</p>
        ) : null}
        {draft.models.length > 0 ? (
          <ul className="mb-1 max-h-52 overflow-y-auto rounded-lg border border-white/10 bg-surface/50">
            {draft.models.map((model) => {
              const isActive = model === selectedModel;
              return (
                <li
                  key={model}
                  className={`flex items-center gap-2 border-b border-white/5 last:border-b-0 ${
                    isActive ? "bg-accent/10" : "hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectModel(model)}
                    title={model}
                    className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-xs transition ${
                      isActive ? "font-medium text-accent" : "text-white"
                    }`}
                  >
                    {isActive ? (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    ) : null}
                    {model}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeModel(model)}
                    className="shrink-0 px-2 py-2.5 text-text-dim transition hover:text-white"
                    title={i18n.settings.removeModel}
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {!draft.apiKey.trim() ? (
          <p className="text-xs text-text-dim">{i18n.settings.apiKeyHint}</p>
        ) : null}
      </div>

      <div className="mt-1 space-y-2">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => void runTest()}
            disabled={testStatus === "loading" || !canTestConnection}
            className="relative z-10 shrink-0 rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testStatus === "loading"
              ? i18n.settings.testing
              : testStatus === "ok" || testStatus === "error"
                ? i18n.settings.testAgain
                : i18n.settings.testConnection}
          </button>
          {testStatus === "ok" ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/20 bg-accent/5 px-3 py-1.5">
              <span className="inline-flex items-center gap-2 text-sm text-accent">
                <FontAwesomeIcon icon={faCircleCheck} />
                {i18n.settings.connectionOk}
              </span>
              {testElapsedMs != null ? (
                <span className="text-xs text-text-muted">
                  {i18n.settings.testDurationLabel}：
                  {formatDurationMs(testElapsedMs, locale)}
                </span>
              ) : null}
            </div>
          ) : null}
          {testStatus === "error" ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5">
              <span className="inline-flex items-start gap-2 text-sm text-red-400">
                <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">{testError}</span>
              </span>
              {testElapsedMs != null ? (
                <span className="shrink-0 text-xs text-text-muted">
                  {i18n.settings.testDurationLabel}：
                  {formatDurationMs(testElapsedMs, locale)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {!selectedModel && draft.models.length > 0 ? (
          <p className="text-xs text-text-dim">{i18n.settings.selectModelFirst}</p>
        ) : null}
      </div>
      </div>

      <div className="h-px bg-white/10" />

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white">
          {i18n.settings.promptRefineSection}
        </h3>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">
            {i18n.settings.promptRefineApiUrl}
          </span>
          <input
            type="url"
            value={draft.promptRefineApiUrl}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                promptRefineApiUrl: event.target.value,
              }))
            }
            placeholder="http://27.159.92.215:8000/v1/chat/completions"
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent/50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">
            {i18n.settings.promptRefineApiKey}
          </span>
          <div className="relative">
            <input
              type={showPromptRefineKey ? "text" : "password"}
              value={draft.promptRefineApiKey}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  promptRefineApiKey: event.target.value,
                }))
              }
              placeholder={i18n.settings.promptRefineApiKeyOptional}
              className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 pr-10 text-sm outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => setShowPromptRefineKey((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
            >
              <FontAwesomeIcon icon={showPromptRefineKey ? faEyeSlash : faEye} />
            </button>
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">
            {i18n.settings.promptRefineModel}
          </span>
          <input
            type="text"
            value={draft.promptRefineModel}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                promptRefineModel: event.target.value,
              }))
            }
            placeholder="prompt-refine"
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent/50"
          />
        </label>

        <div className="space-y-2">
          <button
            type="button"
            onClick={runPromptRefineTest}
            disabled={promptRefineTestOpen || !canTestPromptRefineConnection}
            className="rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {i18n.settings.testConnection}
          </button>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white">{i18n.settings.imageSection}</h3>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">{i18n.settings.imageApiUrl}</span>
          <input
            type="url"
            value={draft.imageApiUrl}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                imageApiUrl: event.target.value,
              }))
            }
            placeholder="http://127.0.0.1:8091/v1/images/generations"
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent/50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">{i18n.settings.imageApiKey}</span>
          <div className="relative">
            <input
              type={showImageKey ? "text" : "password"}
              value={draft.imageApiKey}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  imageApiKey: event.target.value,
                }))
              }
              placeholder="sk-..."
              className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 pr-10 text-sm outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => setShowImageKey((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
            >
              <FontAwesomeIcon icon={showImageKey ? faEyeSlash : faEye} />
            </button>
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">{i18n.settings.imageModel}</span>
          <input
            type="text"
            value={draft.imageModel}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                imageModel: event.target.value,
              }))
            }
            placeholder="qwen-image-2512"
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent/50"
          />
        </label>

        <div className="space-y-2">
          <button
            type="button"
            onClick={runImageTest}
            disabled={imageTestOpen || !canTestImageConnection}
            className="rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {i18n.settings.testConnection}
          </button>
        </div>
      </div>

      <ImageTestResultModal
        open={imageTestOpen}
        settings={imageTestOpen ? imageSettings : null}
        onClose={() => setImageTestOpen(false)}
      />

      <div className="h-px bg-white/10" />

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white">{i18n.settings.videoSection}</h3>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">{i18n.settings.videoApiUrl}</span>
          <input
            type="url"
            value={draft.videoApiUrl}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                videoApiUrl: event.target.value,
              }))
            }
            placeholder={
              isKuaiziVideoApi(draft.videoApiUrl)
                ? KUAIZI_VIDEO_API_URL
                : "http://27.159.92.210:8081/v1/videos/sync"
            }
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent/50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">{i18n.settings.videoApiKey}</span>
          <div className="relative">
            <input
              type={showVideoKey ? "text" : "password"}
              value={draft.videoApiKey}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  videoApiKey: event.target.value,
                }))
              }
              placeholder="wan2.2-ti2v-5b@srd*..."
              className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 pr-10 text-sm outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => setShowVideoKey((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
            >
              <FontAwesomeIcon icon={showVideoKey ? faEyeSlash : faEye} />
            </button>
          </div>
        </label>

        <div className="space-y-2">
          <button
            type="button"
            onClick={runVideoTest}
            disabled={videoTestOpen || !canTestVideoConnection}
            className="rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {i18n.settings.testConnection}
          </button>
        </div>
      </div>

      <VideoTestResultModal
        open={videoTestOpen}
        settings={videoTestOpen ? videoSettings : null}
        onClose={() => setVideoTestOpen(false)}
        onVideoModelChange={(model) =>
          onDraftChange((current) => ({ ...current, videoModel: model }))
        }
      />

      <div className="h-px bg-white/10" />

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white">
          {i18n.settings.imageToVideoSection}
        </h3>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">
            {i18n.settings.imageToVideoApiUrl}
          </span>
          <input
            type="url"
            value={draft.imageToVideoApiUrl}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                imageToVideoApiUrl: event.target.value,
              }))
            }
            placeholder="http://27.159.92.210:8081/v1/videos/sync"
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent/50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">
            {i18n.settings.imageToVideoApiKey}
          </span>
          <div className="relative">
            <input
              type={showImageToVideoKey ? "text" : "password"}
              value={draft.imageToVideoApiKey}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  imageToVideoApiKey: event.target.value,
                }))
              }
              placeholder="wan2.2-ti2v-5b@srd*..."
              className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 pr-10 text-sm outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => setShowImageToVideoKey((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
            >
              <FontAwesomeIcon icon={showImageToVideoKey ? faEyeSlash : faEye} />
            </button>
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-text-muted">
            {i18n.settings.imageToVideoModel}
          </span>
          <input
            type="text"
            readOnly
            value={imageToVideoSettings.imageToVideoModel}
            className={readOnlyFieldClass}
          />
        </label>

        <div className="space-y-2">
          <button
            type="button"
            onClick={runImageToVideoTest}
            disabled={imageToVideoTestOpen || !canTestImageToVideoConnection}
            className="rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {i18n.settings.testConnection}
          </button>
        </div>
      </div>

      <ImageToVideoTestResultModal
        open={imageToVideoTestOpen}
        settings={imageToVideoTestOpen ? imageToVideoSettings : null}
        onClose={() => setImageToVideoTestOpen(false)}
      />
      <PromptRefineTestResultModal
        open={promptRefineTestOpen}
        settings={promptRefineTestOpen ? promptRefineSettings : null}
        onClose={() => setPromptRefineTestOpen(false)}
      />
    </div>
  );
}