import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  batchGenerateDraftAssets,
  extractAssetsFromScripts,
  type DraftAssetItem,
} from "../services/assetExtraction";
import {
  createProjectAsset,
  deleteProjectAsset,
  listProjectAssets,
  regenerateProjectAsset,
  updateProjectAsset,
  type ListProjectAssetsResult,
  type ProjectAssetRecord,
} from "../services/assets";
import { downloadAssetFile } from "../services/mediaDownload";
import { SCRIPT_STATE_SUCCESS, type ScriptRecord } from "../services/script";
import { DEFAULT_NUM_INFERENCE_STEPS } from "../services/config";
import type { AppConfig, CreationProject } from "../types";
import { AssetDetailModal } from "./AssetDetailModal";
import { AssetImagePreviewModal } from "./AssetImagePreviewModal";
import { AssetListTable } from "./AssetListTable";
import { DeleteAssetConfirmModal } from "./DeleteAssetConfirmModal";
import { DraftAssetListTable } from "./DraftAssetListTable";
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
  scripts: ScriptRecord[];
  initialAssets: ListProjectAssetsResult;
  onConfigError: (message: string | null) => void;
  onWorkflowChange?: () => void;
}

export function GenerateAssetsStep({
  project,
  title,
  config,
  scripts,
  initialAssets,
  onConfigError,
  onWorkflowChange,
}: GenerateAssetsStepProps) {
  const s = useTranslationMessages().creation.generateAssetsStep;
  const errors = useTranslationMessages().errors;
  const [assets, setAssets] = useState(initialAssets);
  const [page, setPage] = useState(initialAssets.page);
  const [loading, setLoading] = useState(false);
  const [draftAssets, setDraftAssets] = useState<DraftAssetItem[]>([]);
  const [batchGenerating, setBatchGenerating] = useState(false);
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const batchAbortRef = useRef<AbortController | null>(null);

  const totalPages = Math.max(1, Math.ceil(assets.total / PAGE_SIZE));
  const hasDrafts = draftAssets.length > 0;
  const hasSavedItems = assets.items.length > 0;
  const successfulScripts = scripts.filter(
    (script) => script.scriptState === SCRIPT_STATE_SUCCESS && script.content.trim(),
  );
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

  useEffect(() => {
    return () => {
      batchAbortRef.current?.abort();
    };
  }, []);

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

  const handleRegenerateAsset = useCallback(
    async (
      assetId: number,
      name: string,
      assetType: string,
      prompt: string,
      imageB64: string,
      generationDurationMs: number,
    ) => {
      onConfigError(null);
      const saved = await regenerateProjectAsset({
        projectId: project.id,
        assetId,
        name,
        assetType,
        prompt,
        imageB64,
        generationDurationMs,
        numInferenceSteps: DEFAULT_NUM_INFERENCE_STEPS,
      });
      setPreviewAsset(saved);
      await loadPage(page);
      onWorkflowChange?.();
    },
    [loadPage, onConfigError, onWorkflowChange, page, project.id],
  );

  const handleDeleteAsset = useCallback(async (asset: ProjectAssetRecord) => {
    setDeleteTarget(asset);
  }, []);

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

  const handleBatchExtract = useCallback(() => {
    if (batchGenerating) return;

    setActionNotice(null);
    setActionError(null);
    onConfigError(null);
    if (successfulScripts.length === 0) {
      setActionError(s.noScriptsToExtract);
      onConfigError(s.noScriptsToExtract);
      return;
    }

    const extracted = extractAssetsFromScripts(scripts);
    if (extracted.length === 0) {
      setActionError(s.extractNoAssets);
      onConfigError(s.extractNoAssets);
      return;
    }

    setDraftAssets(extracted);
    setActionNotice(s.extractSuccess(extracted.length));
  }, [
    batchGenerating,
    onConfigError,
    s.extractNoAssets,
    s.extractSuccess,
    s.noScriptsToExtract,
    scripts,
    successfulScripts.length,
  ]);

  const handleDraftNameChange = useCallback((id: string, name: string) => {
    setDraftAssets((current) =>
      current.map((item) => (item.id === id ? { ...item, name } : item)),
    );
  }, []);

  const handleDraftPromptChange = useCallback((id: string, prompt: string) => {
    setDraftAssets((current) =>
      current.map((item) => (item.id === id ? { ...item, prompt } : item)),
    );
  }, []);

  const handleBatchGenerate = useCallback(async () => {
    if (batchGenerating || draftAssets.length === 0) return;

    onConfigError(null);
    if (!config.imageModel.trim()) {
      onConfigError(errors.imageConfigRequired);
      return;
    }

    const invalidDraft = draftAssets.find(
      (item) => !item.name.trim() || !item.prompt.trim(),
    );
    if (invalidDraft) {
      onConfigError(s.draftInvalid);
      return;
    }

    const controller = new AbortController();
    batchAbortRef.current = controller;
    setBatchGenerating(true);

    try {
      const result = await batchGenerateDraftAssets({
        projectId: project.id,
        config,
        items: draftAssets,
        signal: controller.signal,
        onItemProgress: (itemId, patch) => {
          setDraftAssets((current) =>
            current.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          );
        },
      });

      setDraftAssets(result.items);

      const allSucceeded = result.items.every((item) => item.status === "success");
      if (allSucceeded) {
        setDraftAssets([]);
        setActionNotice(s.batchGenerateComplete);
        await loadPage(1);
        onWorkflowChange?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "AbortError") {
        if (message === "IMAGE_CONFIG_REQUIRED") {
          onConfigError(errors.imageConfigRequired);
        } else {
          onConfigError(message);
        }
      }
    } finally {
      batchAbortRef.current = null;
      setBatchGenerating(false);
    }
  }, [
    batchGenerating,
    config,
    draftAssets,
    errors.imageConfigRequired,
    loadPage,
    onConfigError,
    onWorkflowChange,
    project.id,
    s.batchGenerateComplete,
    s.draftInvalid,
  ]);

  const handleViewDraftItem = useCallback(
    (itemId: string) => {
      const target = draftAssets.find((item) => item.id === itemId);
      if (target?.savedAsset) {
        setPreviewAsset(target.savedAsset);
      }
    },
    [draftAssets],
  );

  const handleRegenerateDraftItem = useCallback(
    async (itemId: string) => {
      if (batchGenerating) return;

      const target = draftAssets.find((item) => item.id === itemId);
      if (!target || !target.name.trim() || !target.prompt.trim()) return;

      onConfigError(null);
      if (!config.imageModel.trim()) {
        onConfigError(errors.imageConfigRequired);
        return;
      }

      const controller = new AbortController();
      batchAbortRef.current = controller;
      setBatchGenerating(true);

      try {
        const result = await batchGenerateDraftAssets({
          projectId: project.id,
          config,
          items: [target],
          signal: controller.signal,
          onItemProgress: (id, patch) => {
            if (id !== itemId) return;
            setDraftAssets((current) =>
              current.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item,
              ),
            );
          },
        });

        const updated = result.items[0];
        if (updated?.status === "success") {
          setDraftAssets((current) => current.filter((item) => item.id !== itemId));
          await loadPage(1);
          onWorkflowChange?.();
        } else if (updated) {
          setDraftAssets((current) =>
            current.map((item) => (item.id === itemId ? updated : item)),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message !== "AbortError") {
          onConfigError(message);
        }
      } finally {
        batchAbortRef.current = null;
        setBatchGenerating(false);
      }
    },
    [
      batchGenerating,
      config,
      draftAssets,
      errors.imageConfigRequired,
      loadPage,
      onConfigError,
      onWorkflowChange,
      project.id,
    ],
  );

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

  const draftTableLabels = {
    colName: s.colName,
    colType: s.colType,
    colPrompt: s.colPrompt,
    colStatus: s.colStatus,
    colActions: s.colActions,
    typeCharacter: s.typeCharacter,
    typeScene: s.typeScene,
    typeProp: s.typeProp,
    typeVideo: s.typeVideo,
    statusPending: s.statusPending,
    statusGenerating: s.statusGenerating,
    statusSuccess: s.statusSuccess,
    statusError: s.statusError,
    regenerate: s.regenerate,
    viewImage: s.viewImage,
  };

  const canBatchExtract = !batchGenerating;
  const canBatchGenerate =
    hasDrafts &&
    !batchGenerating &&
    draftAssets.some((item) => item.status === "pending" || item.status === "error");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h2 className="step-panel-title w-fit min-w-0 shrink self-start">{title}</h2>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBatchExtract}
            disabled={!canBatchExtract}
            className="inline-flex items-center rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s.batchExtract}
          </button>
          <button
            type="button"
            onClick={() => void handleBatchGenerate()}
            disabled={!canBatchGenerate}
            className="inline-flex items-center rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {batchGenerating ? s.batchGenerating : s.batchGenerate}
          </button>
          <button
            type="button"
            onClick={() => setGenerateModalOpen(true)}
            className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90"
          >
            {s.generateAsset}
          </button>
        </div>
      </div>

      {actionError ? (
        <p className="mt-3 shrink-0 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      ) : actionNotice ? (
        <p className="mt-3 shrink-0 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-sm text-accent">
          {actionNotice}
        </p>
      ) : hasDrafts ? (
        <p className="mt-3 shrink-0 text-xs text-text-muted">{s.draftHint}</p>
      ) : null}

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-surface/20">
        {hasDrafts ? (
          <DraftAssetListTable
            items={draftAssets}
            labels={draftTableLabels}
            disabled={batchGenerating}
            onNameChange={handleDraftNameChange}
            onPromptChange={handleDraftPromptChange}
            onRegenerateItem={(id) => void handleRegenerateDraftItem(id)}
            onViewItem={handleViewDraftItem}
          />
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted">{s.loading}</p>
          </div>
        ) : hasSavedItems ? (
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

        {!hasDrafts && hasSavedItems ? (
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
        config={config}
        onClose={() => setEditAsset(null)}
        onSubmit={handleUpdateAsset}
        onRegenerate={handleRegenerateAsset}
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
