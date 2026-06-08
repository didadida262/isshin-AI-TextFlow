import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClapperboard } from "@fortawesome/free-solid-svg-icons";
import type { ProjectAssetRecord } from "../services/assets";
import { ASSET_STATE_ERROR, ASSET_STATE_SUCCESS } from "../services/assets";
import { AssetRowActions } from "./AssetRowActions";
import { AssetTypeTag } from "./AssetTypeTag";
import { VideoThumbnail } from "./VideoThumbnail";

interface AssetListTableLabels {
  colPreview: string;
  colName: string;
  colType: string;
  colPrompt: string;
  colModel: string;
  colInferenceSteps: string;
  colDuration: string;
  formatDuration: (ms: number) => string;
  colStatus: string;
  colActions: string;
  edit: string;
  download: string;
  delete: string;
  openActionsMenu: string;
  statusSuccess: string;
  statusError: string;
  typeCharacter: string;
  typeScene: string;
  typeProp: string;
  typeVideo: string;
  noPreview: string;
  viewImage: string;
  viewVideo: string;
}

interface AssetListTableProps {
  items: ProjectAssetRecord[];
  labels: AssetListTableLabels;
  onRowClick?: (asset: ProjectAssetRecord) => void;
  onViewImage?: (asset: ProjectAssetRecord) => void;
  onEdit?: (asset: ProjectAssetRecord) => void;
  onDownload?: (asset: ProjectAssetRecord) => void;
  onDelete?: (asset: ProjectAssetRecord) => void;
}

function statusLabel(
  asset: ProjectAssetRecord,
  labels: AssetListTableLabels,
): string {
  if (asset.assetState === ASSET_STATE_SUCCESS) return labels.statusSuccess;
  if (asset.assetState === ASSET_STATE_ERROR) return labels.statusError;
  return labels.statusError;
}

function isVideoAsset(asset: ProjectAssetRecord): boolean {
  return (
    asset.assetType === "video" ||
    asset.imagePath?.toLowerCase().endsWith(".mp4") === true
  );
}

function statusClass(asset: ProjectAssetRecord): string {
  if (asset.assetState === ASSET_STATE_SUCCESS) return "text-accent";
  return "text-red-400";
}

const colgroup = (
  <colgroup>
    <col className="w-20" />
    <col className="w-36 sm:w-44" />
    <col className="w-20" />
    <col />
    <col className="w-40 sm:w-48" />
    <col className="w-20" />
    <col className="w-24" />
    <col className="w-20" />
    <col className="w-14" />
  </colgroup>
);

export function AssetListTable({
  items,
  labels,
  onRowClick,
  onViewImage,
  onEdit,
  onDownload,
  onDelete,
}: AssetListTableProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="min-h-0 flex-1 overflow-auto select-none">
      <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
        {colgroup}
        <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
          <tr className="border-b border-white/10 text-text-muted">
            <th className="px-3 py-2.5 font-medium">{labels.colPreview}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colName}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colType}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colPrompt}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colModel}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colInferenceSteps}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colDuration}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colStatus}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colActions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((asset) => (
            <tr
              key={asset.id}
              onClick={() => onRowClick?.(asset)}
              className={`border-b border-white/5 align-middle transition ${
                onRowClick
                  ? "cursor-pointer hover:bg-white/[0.04]"
                  : "hover:bg-white/[0.02]"
              }`}
            >
              <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                {asset.imagePath ? (
                  isVideoAsset(asset) ? (
                    <button
                      type="button"
                      title={labels.viewVideo}
                      onClick={() => onViewImage?.(asset)}
                      className="block overflow-hidden rounded-md border border-sky-400/20 bg-sky-400/10 transition hover:border-accent/40 hover:ring-1 hover:ring-accent/30"
                    >
                      <VideoThumbnail
                        src={convertFileSrc(asset.imagePath)}
                        alt={asset.name}
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title={labels.viewImage}
                      onClick={() => onViewImage?.(asset)}
                      className="block overflow-hidden rounded-md border border-white/10 transition hover:border-accent/40 hover:ring-1 hover:ring-accent/30"
                    >
                      <img
                        src={convertFileSrc(asset.imagePath)}
                        alt={asset.name}
                        className="h-14 w-14 object-cover"
                      />
                    </button>
                  )
                ) : isVideoAsset(asset) ? (
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-sky-400/20 bg-sky-400/10">
                    <FontAwesomeIcon
                      icon={faClapperboard}
                      className="text-xl text-sky-300/60"
                    />
                  </span>
                ) : (
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-white/10 text-[10px] text-text-dim">
                    {labels.noPreview}
                  </span>
                )}
              </td>
              <td className="max-w-0 px-3 py-2.5 text-white">
                <p className="truncate">{asset.name}</p>
              </td>
              <td className="px-3 py-2.5">
                <AssetTypeTag assetType={asset.assetType} labels={labels} />
              </td>
              <td className="max-w-0 px-3 py-2.5 text-text-muted">
                <p className="line-clamp-2 break-words">{asset.prompt}</p>
              </td>
              <td className="max-w-0 px-3 py-2.5 text-text-muted">
                <p className="truncate">{asset.model}</p>
              </td>
              <td className="px-3 py-2.5 text-text-muted">
                {asset.numInferenceSteps ?? "—"}
              </td>
              <td className="px-3 py-2.5 text-text-muted">
                {asset.generationDurationMs != null
                  ? labels.formatDuration(asset.generationDurationMs)
                  : "—"}
              </td>
              <td className={`px-3 py-2.5 ${statusClass(asset)}`}>
                {asset.assetState === ASSET_STATE_ERROR && asset.errorReason ? (
                  <p className="truncate text-red-400/90">{asset.errorReason}</p>
                ) : (
                  statusLabel(asset, labels)
                )}
              </td>
              <td
                className="whitespace-nowrap px-3 py-2.5"
                onClick={(event) => event.stopPropagation()}
              >
                <AssetRowActions
                  openMenuLabel={labels.openActionsMenu}
                  editLabel={labels.edit}
                  downloadLabel={labels.download}
                  deleteLabel={labels.delete}
                  downloadDisabled={!asset.imagePath}
                  isOpen={openMenuId === asset.id}
                  onToggle={() =>
                    setOpenMenuId((current) =>
                      current === asset.id ? null : asset.id,
                    )
                  }
                  onClose={() => setOpenMenuId(null)}
                  onEdit={() => onEdit?.(asset)}
                  onDownload={() => onDownload?.(asset)}
                  onDelete={() => onDelete?.(asset)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
