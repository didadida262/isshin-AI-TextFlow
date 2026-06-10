import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import type { DraftAssetItem } from "../services/assetExtraction";
import { AssetTypeTag } from "./AssetTypeTag";

interface DraftAssetListTableLabels {
  colSelect: string;
  selectAll: string;
  colName: string;
  colType: string;
  colPrompt: string;
  colStatus: string;
  typeCharacter: string;
  typeScene: string;
  typeProp: string;
  typeVideo: string;
  statusPending: string;
  statusGenerating: string;
  statusSuccess: string;
  statusError: string;
}

interface DraftAssetListTableProps {
  items: DraftAssetItem[];
  labels: DraftAssetListTableLabels;
  selectedIds: ReadonlySet<string>;
  disabled?: boolean;
  onRowClick?: (item: DraftAssetItem) => void;
  onSelectionChange: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

function isSelectableItem(item: DraftAssetItem): boolean {
  return item.status === "pending" || item.status === "error";
}

function statusLabel(item: DraftAssetItem, labels: DraftAssetListTableLabels): string {
  if (item.status === "generating") return labels.statusGenerating;
  if (item.status === "success") return labels.statusSuccess;
  if (item.status === "error") return labels.statusError;
  return labels.statusPending;
}

function statusBadgeClass(item: DraftAssetItem): string {
  if (item.status === "success") {
    return "border-accent/40 bg-accent/15 text-accent";
  }
  if (item.status === "error") {
    return "border-red-400/40 bg-red-400/15 text-red-300";
  }
  if (item.status === "generating") {
    return "border-sky-400/40 bg-sky-400/15 text-sky-300";
  }
  return "border-amber-400/40 bg-amber-400/15 text-amber-300";
}

const statusBadgeBaseClass =
  "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium leading-none";

function DraftAssetStatusBadge({
  item,
  labels,
}: {
  item: DraftAssetItem;
  labels: DraftAssetListTableLabels;
}) {
  if (item.status === "error" && item.errorReason) {
    return (
      <span
        className={`${statusBadgeBaseClass} max-w-full border-red-400/40 bg-red-400/15 text-red-300`}
        title={item.errorReason}
      >
        <span className="truncate">{item.errorReason}</span>
      </span>
    );
  }

  return (
    <span className={`${statusBadgeBaseClass} ${statusBadgeClass(item)}`}>
      {item.status === "generating" ? (
        <FontAwesomeIcon icon={faSpinner} spin className="text-[10px]" />
      ) : null}
      {statusLabel(item, labels)}
    </span>
  );
}

const headCellClass = "px-3 py-2.5 align-middle";
const nameTextClass =
  "line-clamp-2 w-full overflow-hidden break-words text-sm leading-5 text-white";
const vCenterTdClass = "h-px p-0 align-middle";
const vCenterInnerClass = "flex h-full items-center px-3 py-2.5";
const promptTdClass = "max-w-0 px-3 py-2.5 align-middle";
const promptTextClass =
  "line-clamp-2 h-10 overflow-hidden break-words text-sm leading-5 text-text-muted";

export function DraftAssetListTable({
  items,
  labels,
  selectedIds,
  disabled = false,
  onRowClick,
  onSelectionChange,
  onSelectAll,
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

  const selectableItems = items.filter(isSelectableItem);
  const selectedSelectableCount = selectableItems.filter((item) =>
    selectedIds.has(item.id),
  ).length;
  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectedSelectableCount === selectableItems.length;
  const someSelectableSelected =
    selectedSelectableCount > 0 && !allSelectableSelected;

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-36 sm:w-44" />
            <col className="w-20" />
            <col />
            <col className="w-24" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
            <tr className="border-b border-white/10 text-text-muted">
              <th className={`${headCellClass} font-medium`}>
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate = someSelectableSelected;
                      }
                    }}
                    disabled={disabled || selectableItems.length === 0}
                    aria-label={labels.selectAll}
                    onChange={(event) => onSelectAll(event.target.checked)}
                    className="draft-asset-checkbox"
                  />
                </div>
              </th>
              <th className={`${headCellClass} font-medium`}>{labels.colName}</th>
              <th className={`${headCellClass} font-medium`}>{labels.colType}</th>
              <th className={`${headCellClass} font-medium`}>{labels.colPrompt}</th>
              <th className={`${headCellClass} font-medium`}>{labels.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const rowDisabled =
                disabled || item.status === "generating" || item.status === "success";

              const selectable = isSelectableItem(item);
              const rowEditable = !rowDisabled && Boolean(onRowClick);

              return (
                <tr
                  key={item.id}
                  data-draft-row-id={item.id}
                  onClick={() => {
                    if (rowEditable) onRowClick?.(item);
                  }}
                  className={`border-b border-white/5 transition hover:bg-white/[0.02]${
                    rowEditable ? " cursor-pointer" : ""
                  }`}
                >
                  <td className={vCenterTdClass} onClick={(event) => event.stopPropagation()}>
                    <div className={`${vCenterInnerClass} justify-center`}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        disabled={disabled || !selectable}
                        aria-label={`${labels.colSelect} ${item.name}`}
                        onChange={(event) =>
                          onSelectionChange(item.id, event.target.checked)
                        }
                        className="draft-asset-checkbox"
                      />
                    </div>
                  </td>
                  <td className={vCenterTdClass}>
                    <div className={vCenterInnerClass}>
                      <p className={nameTextClass} title={item.name}>
                        {item.name}
                      </p>
                    </div>
                  </td>
                  <td className={vCenterTdClass}>
                    <div className={vCenterInnerClass}>
                      <AssetTypeTag assetType={item.assetType} labels={labels} />
                    </div>
                  </td>
                  <td className={promptTdClass}>
                    <p className={promptTextClass} title={item.prompt}>
                      {item.prompt}
                    </p>
                  </td>
                  <td className={vCenterTdClass}>
                    <div className={vCenterInnerClass}>
                      <DraftAssetStatusBadge item={item} labels={labels} />
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
