import { useCallback, useEffect, useState } from "react";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  createProjectAsset,
  deleteProjectAsset,
  listProjectAssets,
  updateProjectAsset,
  type ListProjectAssetsResult,
  type ProjectAssetRecord,
} from "../services/assets";
import { downloadAssetFile } from "../services/mediaDownload";
import type { AppConfig, CreationProject } from "../types";
import { AssetDetailModal } from "./AssetDetailModal";
import { AssetImagePreviewModal } from "./AssetImagePreviewModal";
import { AssetListTable } from "./AssetListTable";
import { DeleteAssetConfirmModal } from "./DeleteAssetConfirmModal";
import { EditAssetModal } from "./EditAssetModal";
import {
  GenerateAssetModal,
  type GenerateAssetFormValues,
} from "./GenerateAssetModal";

const PAGE_SIZE = 10;

interface GenerateAssetsStepProps {
  project: CreationProject;
  title: string;
  config: AppConfig;
  initialAssets: ListProjectAssetsResult;
  onConfigError: (message: string | null) => void;
  onWorkflowChange?: () => void;
}

export function GenerateAssetsStep({
  project,
  title,
  config,
  initialAssets,
  onConfigError,
  onWorkflowChange,
}: GenerateAssetsStepProps) {
  const s = useTranslationMessages().creation.generateAssetsStep;
  const [assets, setAssets] = useState(initialAssets);
  const [page, setPage] = useState(initialAssets.page);
  const [loading, setLoading] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<ProjectAssetRecord | null>(
    null,
  );
  const [detailAsset, setDetailAsset] = useState<ProjectAssetRecord | null>(
    null,
  );
  const [editAsset, setEditAsset] = useState<ProjectAssetRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectAssetRecord | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(assets.total / PAGE_SIZE));

  const loadPage = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const result = await listProjectAssets(project.id, nextPage, PAGE_SIZE, {
          excludeAssetTypes: ["video"],
        });
        setAssets(result);
        setPage(result.page);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [project.id],
  );

  useEffect(() => {
    if (page !== initialAssets.page) return;
    setAssets(initialAssets);
  }, [initialAssets, page]);

  const handleCreateAsset = useCallback(
    async (values: GenerateAssetFormValues, imageB64: string) => {
      onConfigError(null);
      const saved = await createProjectAsset({
        projectId: project.id,
        name: values.name,
        assetType: values.assetType,
        prompt: values.prompt,
        model: values.model,
        size: values.size,
        imageB64,
        generationDurationMs: values.generationDurationMs,
        numInferenceSteps: values.numInferenceSteps,
      });

      setPreviewAsset(saved);
      await loadPage(1);
      onWorkflowChange?.();
    },
    [loadPage, onConfigError, onWorkflowChange, project.id],
  );

  const handleUpdateAsset = useCallback(
    async (assetId: number, name: string, assetType: string) => {
      onConfigError(null);
      await updateProjectAsset({
        projectId: project.id,
        assetId,
        name,
        assetType,
      });
      await loadPage(page);
    },
    [loadPage, onConfigError, page, project.id],
  );

  const handleDeleteAsset = useCallback(
    async (asset: ProjectAssetRecord) => {
      setDeleteTarget(asset);
    },
    [],
  );

  const handleDownloadAsset = useCallback(
    async (asset: ProjectAssetRecord) => {
      if (!asset.imagePath) {
        onConfigError(s.downloadNoFile);
        return;
      }

      onConfigError(null);
      try {
        await downloadAssetFile(asset, { dialogTitle: s.downloadDialogTitle });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onConfigError(message);
      }
    },
    [onConfigError, s.downloadDialogTitle, s.downloadNoFile],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    onConfigError(null);
    try {
      await deleteProjectAsset({
        projectId: project.id,
        assetId: deleteTarget.id,
      });

      const nextPage =
        assets.items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteTarget(null);
      await loadPage(nextPage);
      onWorkflowChange?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onConfigError(message);
    } finally {
      setDeleting(false);
    }
  }, [
    assets.items.length,
    deleteTarget,
    deleting,
    loadPage,
    onConfigError,
    onWorkflowChange,
    page,
    project.id,
  ]);

  const tableLabels = {
    colPreview: s.colPreview,
    colName: s.colName,
    colType: s.colType,
    colPrompt: s.colPrompt,
    colModel: s.colModel,
    colInferenceSteps: s.colInferenceSteps,
    colDuration: s.colDuration,
    formatDuration: s.formatDuration,
    colStatus: s.colStatus,
    colActions: s.colActions,
    edit: s.edit,
    download: s.download,
    delete: s.delete,
    openActionsMenu: s.openActionsMenu,
    statusSuccess: s.statusSuccess,
    statusError: s.statusError,
    typeCharacter: s.typeCharacter,
    typeScene: s.typeScene,
    typeProp: s.typeProp,
    typeVideo: s.typeVideo,
    noPreview: s.noPreview,
    viewImage: s.viewImage,
    viewVideo: s.viewVideo,
  };

  const hasItems = assets.items.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h2 className="step-panel-title w-fit min-w-0 shrink self-start">{title}</h2>
        <button
          type="button"
          onClick={() => setGenerateModalOpen(true)}
          className="inline-flex shrink-0 items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90"
        >
          {s.generateAsset}
        </button>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-surface/20">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted">{s.loading}</p>
          </div>
        ) : hasItems ? (
          <AssetListTable
            items={assets.items}
            labels={tableLabels}
            onRowClick={setDetailAsset}
            onViewImage={setPreviewAsset}
            onEdit={setEditAsset}
            onDownload={(asset) => void handleDownloadAsset(asset)}
            onDelete={(asset) => void handleDeleteAsset(asset)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
              {s.emptyHint}
            </p>
          </div>
        )}

        {hasItems ? (
          <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-text-muted">
            <span>{s.pageInfo(page, totalPages, assets.total)}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void loadPage(page - 1)}
                className="rounded-md border border-white/10 px-3 py-1.5 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {s.prevPage}
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => void loadPage(page + 1)}
                className="rounded-md border border-white/10 px-3 py-1.5 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {s.nextPage}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <GenerateAssetModal
        open={generateModalOpen}
        config={config}
        onClose={() => setGenerateModalOpen(false)}
        onSubmit={handleCreateAsset}
      />

      <AssetImagePreviewModal
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
      />

      <AssetDetailModal
        asset={detailAsset}
        onClose={() => setDetailAsset(null)}
      />

      <EditAssetModal
        asset={editAsset}
        onClose={() => setEditAsset(null)}
        onSubmit={handleUpdateAsset}
      />

      <DeleteAssetConfirmModal
        asset={deleteTarget}
        deleting={deleting}
        onClose={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
