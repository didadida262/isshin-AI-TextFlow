import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import type { DraftAssetItem } from "../services/assetExtraction";
import { AssetTypeTag } from "./AssetTypeTag";

interface DraftAssetListTableLabels {
  colName: string;
  colType: string;
  colPrompt: string;
  colStatus: string;
  colActions: string;
  typeCharacter: string;
  typeScene: string;
  typeProp: string;
  typeVideo: string;
  statusPending: string;
  statusGenerating: string;
  statusSuccess: string;
  statusError: string;
  regenerate: string;
  viewImage: string;
}

interface DraftAssetListTableProps {
  items: DraftAssetItem[];
  labels: DraftAssetListTableLabels;
  disabled?: boolean;
  onNameChange: (id: string, name: string) => void;
  onPromptChange: (id: string, prompt: string) => void;
  onRegenerateItem?: (id: string) => void;
  onViewItem?: (id: string) => void;
}

function statusLabel(item: DraftAssetItem, labels: DraftAssetListTableLabels): string {
  if (item.status === "generating") return labels.statusGenerating;
  if (item.status === "success") return labels.statusSuccess;
  if (item.status === "error") return labels.statusError;
  return labels.statusPending;
}

function statusClass(item: DraftAssetItem): string {
  if (item.status === "success") return "text-accent";
  if (item.status === "error") return "text-red-400";
  if (item.status === "generating") return "text-sky-300";
  return "text-text-muted";
}

const plainFieldClass =
  "box-border w-full resize-none rounded-none border-0 bg-transparent px-0 py-0 text-sm leading-snug text-white outline-none ring-0 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50";

const cellClass = "px-3 py-2.5 align-middle";
const cellInnerClass = "flex min-h-11 items-center";

export function DraftAssetListTable({
  items,
  labels,
  disabled = false,
  onNameChange,
  onPromptChange,
  onRegenerateItem,
  onViewItem,
}: DraftAssetListTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrolledGeneratingId = useRef<string | null>(null);

  useEffect(() => {
    const generatingItem = items.find((item) => item.status === "generating");
    const generatingId = generatingItem?.id ?? null;
    if (!generatingId || generatingId === lastScrolledGeneratingId.current) {
      return;
    }

    lastScrolledGeneratingId.current = generatingId;
    requestAnimationFrame(() => {
      const row = scrollRef.current?.querySelector(
        `[data-draft-row-id="${generatingId}"]`,
      );
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [items]);

  useEffect(() => {
    if (items.some((item) => item.status === "generating")) return;
    lastScrolledGeneratingId.current = null;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto select-none">
      <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
        <colgroup>
          <col className="w-36 sm:w-44" />
          <col className="w-20" />
          <col />
          <col className="w-24" />
          <col className="w-24" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
          <tr className="border-b border-white/10 text-text-muted">
            <th className="px-3 py-2.5 font-medium">{labels.colName}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colType}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colPrompt}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colStatus}</th>
            <th className="px-3 py-2.5 font-medium">{labels.colActions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const rowDisabled =
              disabled || item.status === "generating" || item.status === "success";

            return (
              <tr
                key={item.id}
                data-draft-row-id={item.id}
                className="border-b border-white/5 align-middle transition hover:bg-white/[0.02]"
              >
                <td className={cellClass}>
                  <div className={cellInnerClass}>
                    {rowDisabled ? (
                      <p className="line-clamp-2 w-full break-words text-sm leading-snug text-white">
                        {item.name}
                      </p>
                    ) : (
                      <textarea
                        value={item.name}
                        rows={2}
                        onChange={(event) => onNameChange(item.id, event.target.value)}
                        className={`${plainFieldClass} h-11 overflow-hidden`}
                      />
                    )}
                  </div>
                </td>
                <td className={cellClass}>
                  <div className={cellInnerClass}>
                    <AssetTypeTag assetType={item.assetType} labels={labels} />
                  </div>
                </td>
                <td className={cellClass}>
                  <div className={cellInnerClass}>
                    {rowDisabled ? (
                      <p className="line-clamp-2 w-full break-words text-sm leading-snug text-text-muted">
                        {item.prompt}
                      </p>
                    ) : (
                      <textarea
                        value={item.prompt}
                        rows={2}
                        onChange={(event) => onPromptChange(item.id, event.target.value)}
                        className={`${plainFieldClass} h-11 overflow-hidden text-text-muted`}
                      />
                    )}
                  </div>
                </td>
                <td className={`${cellClass} ${statusClass(item)}`}>
                  <div className={cellInnerClass}>
                    {item.status === "error" && item.errorReason ? (
                      <p className="line-clamp-2 w-full break-words text-red-400/90">
                        {item.errorReason}
                      </p>
                    ) : item.status === "generating" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <FontAwesomeIcon
                          icon={faSpinner}
                          spin
                          className="text-xs text-sky-300"
                        />
                        {labels.statusGenerating}
                      </span>
                    ) : (
                      <span>{statusLabel(item, labels)}</span>
                    )}
                  </div>
                </td>
                <td className={cellClass}>
                  <div className={cellInnerClass}>
                    {item.status === "success" && item.savedAsset && onViewItem ? (
                      <button
                        type="button"
                        onClick={() => onViewItem(item.id)}
                        className="rounded-md border border-accent/30 px-2.5 py-1 text-xs text-accent transition hover:bg-accent/10"
                      >
                        {labels.viewImage}
                      </button>
                    ) : item.status === "error" && onRegenerateItem ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onRegenerateItem(item.id)}
                        className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-text-muted transition hover:bg-white/5 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {labels.regenerate}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
