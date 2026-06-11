import { useCallback, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_NUM_INFERENCE_STEPS,
} from "../services/config";
import { generateAssetImageB64 } from "../services/imageGeneration";
import type { ProjectAssetRecord } from "../services/assets";
import type { AppConfig } from "../types";
import { PaintbrushLoading } from "./PaintbrushLoading";
import { ModalPortal } from "./ModalPortal";
import { Select } from "./Select";

interface EditAssetModalProps {
  asset: ProjectAssetRecord | null;
  artStyleId?: string;
  config: AppConfig;
  onClose: () => void;
  onSubmit: (assetId: number, name: string, assetType: string) => Promise<void>;
  onRegenerate: (
    assetId: number,
    name: string,
    assetType: string,
    prompt: string,
    imageB64: string,
    generationDurationMs: number,
  ) => Promise<void>;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50 disabled:opacity-50";

const readOnlyClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-muted outline-none disabled:cursor-default disabled:opacity-70";

const textareaClass =
  "w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-accent/50 disabled:cursor-default disabled:opacity-70";

export function EditAssetModal({
  asset,
  artStyleId,
  config,
  onClose,
  onSubmit,
  onRegenerate,
}: EditAssetModalProps) {
  const m = useTranslationMessages().creation.editAssetModal;
  const generateLabels = useTranslationMessages().creation.generateAssetModal;
  const errors = useTranslationMessages().errors;
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("scene");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  const open = asset !== null;
  const isVideoAsset = asset?.assetType === "video";
  const busy = submitting || regenerating;

  useEffect(() => {
    if (!asset) return;
    setName(asset.name);
    setAssetType(asset.assetType);
    setPrompt(asset.prompt);
    setError("");
  }, [asset]);

  const assetTypeOptions = useMemo(
    () => [
      { value: "character", label: generateLabels.typeCharacter },
      { value: "scene", label: generateLabels.typeScene },
      { value: "prop", label: generateLabels.typeProp },
      ...(asset?.assetType === "video"
        ? [{ value: "video", label: generateLabels.typeVideo ?? "Video" }]
        : []),
    ],
    [
      asset?.assetType,
      generateLabels.typeCharacter,
      generateLabels.typeProp,
      generateLabels.typeScene,
      generateLabels.typeVideo,
    ],
  );

  const imageSettings = useMemo(() => {
    const imageModel = config.imageModel.trim();
    const defaultSize = config.imageDefaultSize.trim() || DEFAULT_IMAGE_SIZE;
    const imageCount =
      Number.isFinite(config.imageCount) && config.imageCount >= 1
        ? config.imageCount
        : DEFAULT_IMAGE_COUNT;
    return { imageModel, defaultSize, imageCount };
  }, [config.imageCount, config.imageDefaultSize, config.imageModel]);

  const trimmedName = name.trim();
  const trimmedPrompt = prompt.trim();
  const hasMetadataChanges =
    asset !== null &&
    (trimmedName !== asset.name || assetType !== asset.assetType);
  const canSave = hasMetadataChanges && trimmedName.length > 0 && !busy;
  const canRegenerate =
    asset !== null &&
    !isVideoAsset &&
    trimmedName.length > 0 &&
    trimmedPrompt.length > 0 &&
    imageSettings.imageModel.length > 0 &&
    !busy;

  const handleSubmit = useCallback(async () => {
    if (!asset || !canSave) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(asset.id, trimmedName, assetType);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : String(submitError);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [asset, assetType, canSave, onClose, onSubmit, trimmedName]);

  const handleRegenerate = useCallback(async () => {
    if (!asset || !canRegenerate) return;
    setRegenerating(true);
    setError("");
    const startedAt = performance.now();
    try {
      const imageB64 = await generateAssetImageB64({
        prompt: trimmedPrompt,
        artStyleId,
        assetType,
        size: asset.size || imageSettings.defaultSize,
        model: asset.model || imageSettings.imageModel,
        n: imageSettings.imageCount,
        numInferenceSteps: asset.numInferenceSteps ?? DEFAULT_NUM_INFERENCE_STEPS,
        settings: {
          imageApiUrl: config.imageApiUrl,
          imageApiKey: config.imageApiKey,
          imageModel: asset.model || imageSettings.imageModel,
          imageDefaultSize: imageSettings.defaultSize,
          imageCount: imageSettings.imageCount,
        },
      });

      const generationDurationMs = Math.max(
        0,
        Math.round(performance.now() - startedAt),
      );

      await onRegenerate(
        asset.id,
        trimmedName,
        assetType,
        trimmedPrompt,
        imageB64,
        generationDurationMs,
      );
      onClose();
    } catch (regenerateError) {
      const message =
        regenerateError instanceof Error
          ? regenerateError.message
          : String(regenerateError);
      if (message === "IMAGE_CONFIG_REQUIRED") {
        setError(errors.imageConfigRequired);
      } else {
        setError(message);
      }
    } finally {
      setRegenerating(false);
    }
  }, [
    artStyleId,
    asset,
    assetType,
    canRegenerate,
    config.imageApiKey,
    config.imageApiUrl,
    errors.imageConfigRequired,
    imageSettings.defaultSize,
    imageSettings.imageCount,
    imageSettings.imageModel,
    onClose,
    onRegenerate,
    trimmedName,
    trimmedPrompt,
  ]);

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && asset ? (
        <motion.div
          key="edit-asset-modal"
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
            onClick={busy ? undefined : onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-asset-title"
            className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-white/10 bg-surface shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={spring}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
              <h3 id="edit-asset-title" className="text-base font-semibold text-white">
                {m.title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {asset.imagePath ? (
                  <div className="flex items-center justify-center rounded-lg border border-white/10 bg-black/30 p-3">
                    {isVideoAsset || asset.imagePath.toLowerCase().endsWith(".mp4") ? (
                      <video
                        src={convertFileSrc(asset.imagePath)}
                        controls
                        playsInline
                        className="max-h-[min(40vh,360px)] w-auto max-w-full rounded-md object-contain"
                      />
                    ) : (
                      <img
                        src={convertFileSrc(asset.imagePath)}
                        alt={asset.name}
                        className="max-h-[min(40vh,360px)] w-auto max-w-full rounded-md object-contain"
                      />
                    )}
                  </div>
                ) : null}

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{generateLabels.nameLabel}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={generateLabels.namePlaceholder}
                    disabled={busy}
                    className={fieldClass}
                  />
                </label>

                <div className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{generateLabels.typeLabel}</span>
                  <Select
                    value={assetType}
                    options={assetTypeOptions}
                    onChange={setAssetType}
                    disabled={busy || isVideoAsset}
                  />
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{generateLabels.promptLabel}</span>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    readOnly={isVideoAsset}
                    disabled={busy || isVideoAsset}
                    rows={8}
                    className={`${textareaClass} max-h-[240px] overflow-y-auto`}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{generateLabels.modelLabel}</span>
                  <input value={asset.model} disabled readOnly className={readOnlyClass} />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{generateLabels.sizeLabel}</span>
                  <input value={asset.size} disabled readOnly className={readOnlyClass} />
                </label>

                {error ? (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                {m.cancel}
              </button>
              {!isVideoAsset ? (
                <button
                  type="button"
                  onClick={() => void handleRegenerate()}
                  disabled={!canRegenerate}
                  className="rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {regenerating ? m.regenerating : m.regenerate}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSave}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? m.saving : m.confirm}
              </button>
            </div>

            {busy ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-black/60 backdrop-blur-[1px]"
                aria-live="polite"
                aria-busy="true"
              >
                <PaintbrushLoading
                  label={regenerating ? m.regenerating : m.saving}
                />
              </div>
            ) : null}
          </motion.div>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
