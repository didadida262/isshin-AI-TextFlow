import { type ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  ASSET_STATE_ERROR,
  ASSET_STATE_SUCCESS,
  type ProjectAssetRecord,
} from "../services/assets";
import { AssetTypeTag } from "./AssetTypeTag";
import { MarkdownContent } from "./MarkdownContent";
import { ModalPortal } from "./ModalPortal";

interface AssetDetailModalProps {
  asset: ProjectAssetRecord | null;
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

function isVideoAsset(asset: ProjectAssetRecord): boolean {
  return (
    asset.assetType === "video" ||
    asset.imagePath?.toLowerCase().endsWith(".mp4") === true
  );
}

export function AssetDetailModal({ asset, onClose }: AssetDetailModalProps) {
  const i18n = useTranslationMessages();
  const s = i18n.creation.generateAssetsStep;

  return (
    <ModalPortal>
      <AnimatePresence>
        {asset ? (
          <motion.div
            key={`asset-detail-${asset.id}`}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={s.previewClose}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="asset-detail-title"
              className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-surface shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                <h3
                  id="asset-detail-title"
                  className="min-w-0 text-base font-semibold text-white"
                >
                  {s.assetDetailTitle}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/10 hover:text-white"
                  aria-label={s.previewClose}
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <dl className="space-y-5">
                  <DetailField label={s.colPreview}>
                    {asset.imagePath ? (
                      <div className="flex items-center justify-center rounded-lg border border-white/10 bg-black/30 p-3">
                        {isVideoAsset(asset) ? (
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
                    ) : (
                      <span className="text-text-muted">{s.noPreview}</span>
                    )}
                  </DetailField>

                  <DetailField label={s.colName}>{asset.name}</DetailField>

                  <DetailField label={s.colType}>
                    <AssetTypeTag assetType={asset.assetType} labels={s} />
                  </DetailField>

                  <DetailField label={s.colStatus}>
                    {asset.assetState === ASSET_STATE_SUCCESS ? (
                      <span className="inline-flex items-center gap-2 text-accent">
                        <FontAwesomeIcon icon={faCircleCheck} />
                        {s.statusSuccess}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-red-400">
                        <FontAwesomeIcon icon={faCircleExclamation} />
                        {s.statusError}
                      </span>
                    )}
                  </DetailField>

                  {asset.assetState === ASSET_STATE_ERROR && asset.errorReason ? (
                    <DetailField label={s.colErrorReason}>
                      <p className="whitespace-pre-wrap break-words text-red-400">
                        {asset.errorReason}
                      </p>
                    </DetailField>
                  ) : null}

                  <DetailField label={s.colPrompt}>
                    {asset.prompt.trim() ? (
                      <div className="text-text-muted">
                        <MarkdownContent content={asset.prompt} />
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </DetailField>

                  <DetailField label={s.colModel}>{asset.model}</DetailField>

                  <DetailField label={s.colSize}>{asset.size}</DetailField>

                  <DetailField label={s.colInferenceSteps}>
                    {asset.numInferenceSteps ?? "—"}
                  </DetailField>

                  <DetailField label={s.colDuration}>
                    {asset.generationDurationMs != null
                      ? s.formatDuration(asset.generationDurationMs)
                      : "—"}
                  </DetailField>
                </dl>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
