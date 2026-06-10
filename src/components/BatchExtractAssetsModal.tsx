import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { DraftAssetItem } from "../services/assetExtraction";
import { DraftAssetEditModal } from "./DraftAssetEditModal";
import { DraftAssetListTable } from "./DraftAssetListTable";
import { ModalPortal } from "./ModalPortal";

interface DraftTableLabels {
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

interface BatchExtractAssetsModalProps {
  open: boolean;
  items: DraftAssetItem[];
  selectedIds: ReadonlySet<string>;
  batchGenerating: boolean;
  notice: string | null;
  labels: DraftTableLabels;
  onClose: () => void;
  onBatchGenerate: () => void;
  onDraftSave: (id: string, name: string, prompt: string) => void;
  onSelectionChange: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

export function BatchExtractAssetsModal({
  open,
  items,
  selectedIds,
  batchGenerating,
  notice,
  labels,
  onClose,
  onBatchGenerate,
  onDraftSave,
  onSelectionChange,
  onSelectAll,
}: BatchExtractAssetsModalProps) {
  const s = useTranslationMessages().creation.generateAssetsStep;
  const [editingItem, setEditingItem] = useState<DraftAssetItem | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingItem(null);
    }
  }, [open]);

  useEffect(() => {
    if (!editingItem) return;
    const stillExists = items.some((item) => item.id === editingItem.id);
    if (!stillExists) {
      setEditingItem(null);
    }
  }, [editingItem, items]);

  const canBatchGenerate =
    items.length > 0 &&
    !batchGenerating &&
    items.some(
      (item) =>
        selectedIds.has(item.id) &&
        (item.status === "pending" || item.status === "error"),
    );

  const handleClose = () => {
    onClose();
  };

  const handleRowClick = (item: DraftAssetItem) => {
    if (batchGenerating) return;
    if (item.status !== "pending" && item.status !== "error") return;
    setEditingItem(item);
  };

  const handleDraftSave = (id: string, name: string, prompt: string) => {
    onDraftSave(id, name, prompt);
    setEditingItem(null);
  };

  return (
    <>
    <DraftAssetEditModal
      item={editingItem}
      onClose={() => setEditingItem(null)}
      onSave={handleDraftSave}
    />
    <ModalPortal>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="batch-extract-assets-modal"
            className="fixed inset-0 z-[65] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={s.cancel}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={handleClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="batch-extract-assets-title"
              className="relative z-10 flex max-h-[min(720px,calc(100dvh-3rem))] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/10 bg-surface shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <h3
                    id="batch-extract-assets-title"
                    className="text-base font-semibold text-white"
                  >
                    {s.batchExtractModalTitle}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">{s.draftHint}</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              {notice ? (
                <p className="shrink-0 border-b border-accent/20 bg-accent/10 px-5 py-2.5 text-sm text-accent">
                  {notice}
                </p>
              ) : null}

              <div className="min-h-0 flex-1 overflow-hidden bg-surface/20">
                <DraftAssetListTable
                  items={items}
                  labels={labels}
                  selectedIds={selectedIds}
                  disabled={batchGenerating}
                  onRowClick={handleRowClick}
                  onSelectionChange={onSelectionChange}
                  onSelectAll={onSelectAll}
                />
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-5 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  {s.cancel}
                </button>
                <button
                  type="button"
                  onClick={onBatchGenerate}
                  disabled={!canBatchGenerate}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {batchGenerating ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                      {s.batchGenerating}
                    </>
                  ) : (
                    s.batchGenerate
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
    </>
  );
}
