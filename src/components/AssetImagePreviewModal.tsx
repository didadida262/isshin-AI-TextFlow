import { convertFileSrc } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ProjectAssetRecord } from "../services/assets";
import { ModalPortal } from "./ModalPortal";
import { AssetTypeTag } from "./AssetTypeTag";

interface AssetImagePreviewModalProps {
  asset: ProjectAssetRecord | null;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

function isVideoAsset(asset: ProjectAssetRecord): boolean {
  return (
    asset.assetType === "video" ||
    asset.imagePath?.toLowerCase().endsWith(".mp4") === true
  );
}

export function AssetImagePreviewModal({
  asset,
  onClose,
}: AssetImagePreviewModalProps) {
  const s = useTranslationMessages().creation.generateAssetsStep;

  return (
    <ModalPortal>
      <AnimatePresence>
        {asset ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={s.previewClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-preview-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-white/10 bg-surface shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={spring}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <h3
                  id="asset-preview-title"
                  className="truncate text-base font-semibold text-white"
                >
                  {asset.name}
                </h3>
                <p className="mt-0.5 text-xs text-text-muted">{s.previewTitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-white/10 bg-black/30 p-3">
                {asset.imagePath ? (
                  isVideoAsset(asset) ? (
                    <video
                      src={convertFileSrc(asset.imagePath)}
                      controls
                      playsInline
                      className="max-h-[min(60vh,640px)] w-auto max-w-full rounded-md object-contain"
                    />
                  ) : (
                    <img
                      src={convertFileSrc(asset.imagePath)}
                      alt={asset.name}
                      className="max-h-[min(60vh,640px)] w-auto max-w-full rounded-md object-contain"
                    />
                  )
                ) : (
                  <p className="text-sm text-text-muted">{s.noPreview}</p>
                )}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <dt className="text-text-dim">{s.colType}</dt>
                  <dd className="mt-1">
                    <AssetTypeTag assetType={asset.assetType} labels={s} />
                  </dd>
                </div>
                <div>
                  <dt className="text-text-dim">{s.colSize}</dt>
                  <dd className="mt-1 text-white">{asset.size}</dd>
                </div>
                <div>
                  <dt className="text-text-dim">{s.colModel}</dt>
                  <dd className="mt-1 text-white">{asset.model}</dd>
                </div>
                <div>
                  <dt className="text-text-dim">{s.colInferenceSteps}</dt>
                  <dd className="mt-1 text-white">
                    {asset.numInferenceSteps ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-dim">{s.colDuration}</dt>
                  <dd className="mt-1 text-white">
                    {asset.generationDurationMs != null
                      ? s.formatDuration(asset.generationDurationMs)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-dim">{s.colStatus}</dt>
                  <dd className="mt-1 text-accent">{s.statusSuccess}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-text-dim">{s.colPrompt}</dt>
                  <dd className="mt-1 leading-relaxed text-text-muted">
                    {asset.prompt}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-end border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white"
              >
                {s.previewClose}
              </button>
            </div>
          </motion.div>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
