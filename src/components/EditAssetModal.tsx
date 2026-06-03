import { useCallback, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ProjectAssetRecord } from "../services/assets";
import { PaintbrushLoading } from "./PaintbrushLoading";
import { ModalPortal } from "./ModalPortal";
import { Select } from "./Select";

interface EditAssetModalProps {
  asset: ProjectAssetRecord | null;
  onClose: () => void;
  onSubmit: (assetId: number, name: string, assetType: string) => Promise<void>;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-accent/50 disabled:opacity-50";

const readOnlyClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-muted outline-none disabled:cursor-default disabled:opacity-70";

const readOnlyTextareaClass =
  "w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-muted outline-none disabled:cursor-default disabled:opacity-70";

export function EditAssetModal({ asset, onClose, onSubmit }: EditAssetModalProps) {
  const m = useTranslationMessages().creation.editAssetModal;
  const generateLabels = useTranslationMessages().creation.generateAssetModal;
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("scene");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const open = asset !== null;

  useEffect(() => {
    if (!asset) return;
    setName(asset.name);
    setAssetType(asset.assetType);
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

  const trimmedName = name.trim();
  const hasChanges =
    asset !== null &&
    (trimmedName !== asset.name || assetType !== asset.assetType);
  const canSubmit = hasChanges && trimmedName.length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!asset || !canSubmit) return;
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
  }, [asset, assetType, canSubmit, onClose, onSubmit, trimmedName]);

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
            onClick={submitting ? undefined : onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-asset-title"
            className="relative z-10 flex max-h-[min(520px,calc(100dvh-7rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-surface shadow-2xl"
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
                disabled={submitting}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {asset.imagePath ? (
                  <div className="flex justify-center">
                    {asset.assetType === "video" ||
                    asset.imagePath.toLowerCase().endsWith(".mp4") ? (
                      <video
                        src={convertFileSrc(asset.imagePath)}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-20 w-20 rounded-lg border border-white/10 object-cover"
                      />
                    ) : (
                      <img
                        src={convertFileSrc(asset.imagePath)}
                        alt={asset.name}
                        className="h-20 w-20 rounded-lg border border-white/10 object-cover"
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
                    disabled={submitting}
                    className={fieldClass}
                  />
                </label>

                <div className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{generateLabels.typeLabel}</span>
                  <Select
                    value={assetType}
                    options={assetTypeOptions}
                    onChange={setAssetType}
                    disabled={submitting}
                  />
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs text-text-muted">{generateLabels.promptLabel}</span>
                  <textarea
                    value={asset.prompt}
                    readOnly
                    disabled
                    rows={3}
                    className={`${readOnlyTextareaClass} max-h-[96px] overflow-y-auto`}
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
                disabled={submitting}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                {m.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? m.saving : m.confirm}
              </button>
            </div>

            {submitting ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-black/60 backdrop-blur-[1px]"
                aria-live="polite"
                aria-busy="true"
              >
                <PaintbrushLoading label={m.saving} />
              </div>
            ) : null}
          </motion.div>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
