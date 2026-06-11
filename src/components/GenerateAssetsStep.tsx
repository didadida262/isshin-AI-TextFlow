import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  useGenerationJobs,
  type ImageJobCompleteResult,
} from "../contexts/GenerationJobsContext";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  buildDraftImageJobValues,
  extractAssetsFromScripts,
  type DraftAssetItem,
} from "../services/assetExtraction";
import {
  deleteProjectAsset,
  listProjectAssets,
  regenerateProjectAsset,
  updateProjectAsset,
  type ListProjectAssetsResult,
  type ProjectAssetRecord,
} from "../services/assets";
import { DEFAULT_NUM_INFERENCE_STEPS } from "../services/config";
import { downloadAssetFile } from "../services/mediaDownload";
import { SCRIPT_STATE_SUCCESS, type ScriptRecord } from "../services/script";
import type { AppConfig, CreationProject } from "../types";
import { BatchExtractAssetsModal } from "./BatchExtractAssetsModal";
import { AssetDetailModal } from "./AssetDetailModal";
import { AssetImagePreviewModal } from "./AssetImagePreviewModal";
import { AssetListTable, buildAssetTableRows } from "./AssetListTable";
import { DeleteAssetConfirmModal } from "./DeleteAssetConfirmModal";
import { EditAssetModal } from "./EditAssetModal";
import { GenerateAssetModal } from "./GenerateAssetModal";

const PAGE_SIZE = 10;

interface AssetDraftSessionState {
  draftAssets: DraftAssetItem[];
  selectedDraftIds: string[];
  batchGenerating: boolean;
  extractNotice: string | null;
}

const assetDraftCache = new Map<string, AssetDraftSessionState>();

function getAssetDraftSession(projectId: string): AssetDraftSessionState {
  return (
    assetDraftCache.get(projectId) ?? {
      draftAssets: [],
      selectedDraftIds: [],
      batchGenerating: false,
      extractNotice: null,
    }
  );
}

function syncAssetDraftSession(
  projectId: string,
  patch: Partial<AssetDraftSessionState>,
): void {
  const current = getAssetDraftSession(projectId);
  assetDraftCache.set(projectId, { ...current, ...patch });
}

interface GenerateAssetsStepProps {
  project: CreationProject;
  title: string;
  config: AppConfig;
  selectedModel: string;
  scripts: ScriptRecord[];
  initialAssets: ListProjectAssetsResult;
  onConfigError: (message: string | null) => void;
  onWorkflowChange?: () => void;
}

export function GenerateAssetsStep({
  project,
  title,
  config,
  selectedModel,
  scripts,
  initialAssets,
  onConfigError,
  onWorkflowChange,
}: GenerateAssetsStepProps) {
  const s = useTranslationMessages().creation.generateAssetsStep;
  const errors = useTranslationMessages().errors;
  const cachedDraftSession = getAssetDraftSession(project.id);
  const [assets, setAssets] = useState(initialAssets);
  const [page, setPage] = useState(initialAssets.page);
  const [loading, setLoading] = useState(false);
  const [draftAssets, setDraftAssets] = useState<DraftAssetItem[]>(
    () => cachedDraftSession.draftAssets,
  );
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(cachedDraftSession.selectedDraftIds),
  );
  const [batchGenerating, setBatchGenerating] = useState(
    () => cachedDraftSession.batchGenerating,
  );
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [extractNotice, setExtractNotice] = useState<string | null>(
    () => cachedDraftSession.extractNotice,
  );
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
  const extractAbortRef = useRef<AbortController | null>(null);
  const batchKnownAssetIdsRef = useRef<Set<number>>(new Set());
  const { startImageJob, navigationTarget, clearNavigationTarget } =
    useGenerationJobs();

  const totalPages = Math.max(1, Math.ceil(assets.total / PAGE_SIZE));
  const hasDrafts = draftAssets.length > 0;
  const hasSavedItems = assets.items.length > 0;
  const draftTableItems = useMemo(
    () =>
      draftAssets.filter(
        (item) =>
          item.status === "pending" ||
          item.status === "generating" ||
          item.status === "error" ||
          (item.status === "success" && item.savedAsset),
      ),
    [draftAssets],
  );
  const hasDisplayItems = useMemo(
    () =>
      buildAssetTableRows(
        assets.items,
        draftTableItems,
        batchKnownAssetIdsRef.current,
      ).length > 0,
    [assets.items, draftTableItems, batchGenerating],
  );
  const successfulScripts = scripts.filter(
    (script) => script.scriptState === SCRIPT_STATE_SUCCESS && script.content.trim(),
  );
  const loadPage = useCallback(
    async (nextPage: number, options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
      }
      try {
        const result = await listProjectAssets(project.id, nextPage, PAGE_SIZE, {
          excludeAssetTypes: ["video"],
        });
        setAssets(result);
        setPage(result.page);
        return result;
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [project.id],
  );

  useEffect(() => {
    if (page !== initialAssets.page) return;
    setAssets(initialAssets);
  }, [initialAssets, page]);

  useEffect(() => {
    syncAssetDraftSession(project.id, {
      draftAssets,
      selectedDraftIds: [...selectedDraftIds],
      batchGenerating,
      extractNotice,
    });
  }, [
    batchGenerating,
    draftAssets,
    extractNotice,
    project.id,
    selectedDraftIds,
  ]);

  useEffect(() => {
    return () => {
      extractAbortRef.current?.abort();
    };
  }, []);

  const validateExtractConfig = useCallback((): string | null => {
    if (!config.baseUrl.trim() || !config.apiKey.trim()) {
      return errors.configRequired;
    }
    const model = selectedModel.trim() || config.models[0]?.trim() || "";
    if (!model) {
      return errors.modelsRequired;
    }
    return null;
  }, [
    config.apiKey,
    config.baseUrl,
    config.models,
    errors.configRequired,
    errors.modelsRequired,
    selectedModel,
  ]);

  useEffect(() => {
    if (
      !navigationTarget ||
      navigationTarget.projectId !== project.id ||
      navigationTarget.stepId !== "generateAssets" ||
      navigationTarget.assetId == null
    ) {
      return;
    }

    const assetId = navigationTarget.assetId;
    let cancelled = false;

    void (async () => {
      const result = await listProjectAssets(project.id, 1, 100, {
        excludeAssetTypes: ["video"],
      });
      if (cancelled) return;

      const asset = result.items.find((item) => item.id === assetId);
      if (asset) {
        setPreviewAsset(asset);
        await loadPage(1);
      }
      clearNavigationTarget();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clearNavigationTarget,
    loadPage,
    navigationTarget,
    project.id,
  ]);

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

  const handleBatchExtract = useCallback(async () => {
    if (batchGenerating || extracting) return;

    setActionNotice(null);
    setActionError(null);
    onConfigError(null);

    const configError = validateExtractConfig();
    if (configError) {
      setActionError(configError);
      onConfigError(configError);
      return;
    }

    if (successfulScripts.length === 0) {
      setActionError(s.noScriptsToExtract);
      onConfigError(s.noScriptsToExtract);
      return;
    }

    const model = selectedModel.trim() || config.models[0]?.trim() || "";
    extractAbortRef.current?.abort();
    const controller = new AbortController();
    extractAbortRef.current = controller;

    setExtracting(true);
    setExtractProgress(null);

    try {
      const extracted = await extractAssetsFromScripts({
        config,
        model,
        scripts,
        artStyleId: project.artStyle,
        signal: controller.signal,
        onProgress: setExtractProgress,
      });

      if (extracted.length === 0) {
        setActionError(s.extractNoAssets);
        onConfigError(s.extractNoAssets);
        return;
      }

      setDraftAssets(extracted);
      setSelectedDraftIds(new Set(extracted.map((item) => item.id)));
      setExtractNotice(s.extractSuccess(extracted.length));
      setExtractModalOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const aborted =
        message === "AbortError" ||
        (error instanceof DOMException && error.name === "AbortError");
      if (aborted) return;
      if (message === "MODEL_REQUIRED") {
        setActionError(errors.modelsRequired);
        onConfigError(errors.modelsRequired);
        return;
      }
      setActionError(message);
      onConfigError(message);
    } finally {
      setExtracting(false);
      setExtractProgress(null);
    }
  }, [
    batchGenerating,
    config,
    errors.modelsRequired,
    extracting,
    onConfigError,
    s.extractNoAssets,
    s.extractSuccess,
    s.noScriptsToExtract,
    project.artStyle,
    scripts,
    selectedModel,
    successfulScripts.length,
    validateExtractConfig,
  ]);

  const handleDraftSave = useCallback((id: string, name: string, prompt: string) => {
    setDraftAssets((current) =>
      current.map((item) =>
        item.id === id ? { ...item, name, prompt } : item,
      ),
    );
  }, []);

  const handleDraftSelectionChange = useCallback((id: string, selected: boolean) => {
    setSelectedDraftIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleDraftSelectAll = useCallback(
    (selected: boolean) => {
      setSelectedDraftIds(() => {
        if (!selected) return new Set();
        return new Set(
          draftAssets
            .filter((item) => item.status === "pending" || item.status === "error")
            .map((item) => item.id),
        );
      });
    },
    [draftAssets],
  );

  const checkBatchFinalize = useCallback(
    (drafts: DraftAssetItem[]) => {
      const stillGenerating = drafts.some((item) => item.status === "generating");
      if (stillGenerating) return;

      setBatchGenerating(false);

      const hasPendingOrError = drafts.some(
        (item) => item.status === "pending" || item.status === "error",
      );
      if (!hasPendingOrError) {
        setDraftAssets([]);
        setSelectedDraftIds(new Set());
        setExtractNotice(null);
        setExtractModalOpen(false);
        syncAssetDraftSession(project.id, {
          draftAssets: [],
          selectedDraftIds: [],
          batchGenerating: false,
          extractNotice: null,
        });
        setActionNotice(s.batchGenerateComplete);
        void loadPage(1, { silent: true }).then(() => onWorkflowChange?.());
      }
    },
    [loadPage, onWorkflowChange, project.id, s.batchGenerateComplete],
  );

  const handleDraftJobComplete = useCallback(
    (draftId: string, result: ImageJobCompleteResult) => {
      setDraftAssets((current) => {
        const updated = current.map((item) => {
          if (item.id !== draftId) return item;
          if (result.success && result.asset) {
            return {
              ...item,
              status: "success" as const,
              savedAssetId: result.asset.id,
              savedAsset: result.asset,
              errorReason: undefined,
            };
          }
          return {
            ...item,
            status: "error" as const,
            errorReason: result.errorMessage ?? "Unknown error",
          };
        });
        checkBatchFinalize(updated);
        return updated;
      });
    },
    [checkBatchFinalize],
  );

  useEffect(() => {
    if (!batchGenerating) return;

    setDraftAssets((current) => {
      let changed = false;
      const next = current.map((draft) => {
        if (draft.status !== "generating") return draft;

        const match = assets.items.find(
          (asset) =>
            !batchKnownAssetIdsRef.current.has(asset.id) &&
            asset.assetType === draft.assetType &&
            asset.name.trim() === draft.name.trim() &&
            asset.prompt.trim() === draft.prompt.trim(),
        );
        if (!match) return draft;

        changed = true;
        return {
          ...draft,
          status: "success" as const,
          savedAssetId: match.id,
          savedAsset: match,
          errorReason: undefined,
        };
      });

      if (changed) {
        checkBatchFinalize(next);
      }
      return changed ? next : current;
    });
  }, [assets.items, batchGenerating, checkBatchFinalize]);

  const handleBatchGenerate = useCallback(() => {
    if (batchGenerating || draftAssets.length === 0) return;

    setExtractModalOpen(true);
    onConfigError(null);
    if (!config.imageModel.trim()) {
      onConfigError(errors.imageConfigRequired);
      return;
    }

    const itemsToGenerate = draftAssets.filter(
      (item) =>
        selectedDraftIds.has(item.id) &&
        (item.status === "pending" || item.status === "error"),
    );
    if (itemsToGenerate.length === 0) {
      onConfigError(s.noDraftSelected);
      return;
    }

    const invalidDraft = itemsToGenerate.find(
      (item) => !item.name.trim() || !item.prompt.trim(),
    );
    if (invalidDraft) {
      onConfigError(s.draftInvalid);
      return;
    }

    const generatingIds = new Set(itemsToGenerate.map((item) => item.id));
    setDraftAssets((current) =>
      current.map((item) =>
        generatingIds.has(item.id)
          ? { ...item, status: "generating" as const, errorReason: undefined }
          : item,
      ),
    );

    batchKnownAssetIdsRef.current = new Set(assets.items.map((asset) => asset.id));
    setBatchGenerating(true);
    setActionNotice(null);

    for (const item of itemsToGenerate) {
      startImageJob({
        projectId: project.id,
        projectName: project.name,
        artStyleId: project.artStyle,
        config,
        values: buildDraftImageJobValues(item, config),
        onComplete: (result) => handleDraftJobComplete(item.id, result),
      });
    }
  }, [
    assets.items,
    batchGenerating,
    config,
    draftAssets,
    errors.imageConfigRequired,
    handleDraftJobComplete,
    onConfigError,
    project.id,
    project.name,
    s.draftInvalid,
    s.noDraftSelected,
    selectedDraftIds,
    startImageJob,
  ]);

  const handleCloseExtractModal = useCallback(() => {
    setExtractModalOpen(false);
    if (batchGenerating) {
      setActionNotice(s.batchGenerateBackground);
    }
  }, [batchGenerating, s.batchGenerateBackground]);

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
    statusPending: s.statusPending,
    statusGenerating: s.statusGenerating,
    typeCharacter: s.typeCharacter,
    typeScene: s.typeScene,
    typeProp: s.typeProp,
    typeVideo: s.typeVideo,
    noPreview: s.noPreview,
    viewImage: s.viewImage,
    viewVideo: s.viewVideo,
  };

  const draftTableLabels = {
    colSelect: s.colSelect,
    selectAll: s.selectAll,
    colName: s.colName,
    colType: s.colType,
    colPrompt: s.colPrompt,
    colStatus: s.colStatus,
    typeCharacter: s.typeCharacter,
    typeScene: s.typeScene,
    typeProp: s.typeProp,
    typeVideo: s.typeVideo,
    statusPending: s.statusPending,
    statusGenerating: s.statusGenerating,
    statusSuccess: s.statusSuccess,
    statusError: s.statusError,
  };

  const canBatchExtract = !batchGenerating && !extracting;

  const handleOpenDraftModal = useCallback(() => {
    if (batchGenerating || !hasDrafts) return;
    setExtractModalOpen(true);
  }, [batchGenerating, hasDrafts]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h2 className="step-panel-title w-fit min-w-0 shrink self-start">{title}</h2>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {hasDrafts ? (
            <button
              type="button"
              onClick={handleOpenDraftModal}
              disabled={batchGenerating}
              className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {batchGenerating ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                  {s.batchGenerating}
                </>
              ) : (
                s.viewExtractedAssets
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleBatchExtract()}
              disabled={!canBatchExtract}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {extracting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                  {extractProgress
                    ? s.batchExtractingProgress(
                        extractProgress.completed,
                        extractProgress.total,
                      )
                    : s.batchExtracting}
                </>
              ) : (
                s.batchExtract
              )}
            </button>
          )}
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
      ) : null}

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-surface/20">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted">{s.loading}</p>
          </div>
        ) : hasDisplayItems ? (
          <AssetListTable
            items={assets.items}
            draftPlaceholders={draftTableItems}
            knownAssetIdsBeforeBatch={batchKnownAssetIdsRef.current}
            draftModel={config.imageModel.trim() || "—"}
            draftInferenceSteps={DEFAULT_NUM_INFERENCE_STEPS}
            labels={tableLabels}
            onRowClick={setDetailAsset}
            onViewImage={setPreviewAsset}
            onEdit={setEditAsset}
            onDownload={(asset) => void handleDownloadAsset(asset)}
            onDelete={(asset) => void handleDeleteAsset(asset)}
          />
        ) : extracting ? (
          <div
            className="flex flex-1 items-center justify-center px-6"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="inline-flex items-center gap-2 text-sm text-text-muted">
              <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
              {extractProgress
                ? s.batchExtractingProgress(
                    extractProgress.completed,
                    extractProgress.total,
                  )
                : s.batchExtracting}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
              {s.emptyHint}
            </p>
          </div>
        )}

        {hasSavedItems ? (
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

      <BatchExtractAssetsModal
        open={extractModalOpen}
        items={draftAssets}
        selectedIds={selectedDraftIds}
        batchGenerating={batchGenerating}
        notice={extractNotice}
        labels={draftTableLabels}
        onClose={handleCloseExtractModal}
        onBatchGenerate={() => void handleBatchGenerate()}
        onDraftSave={handleDraftSave}
        onSelectionChange={handleDraftSelectionChange}
        onSelectAll={handleDraftSelectAll}
      />

      <GenerateAssetModal
        open={generateModalOpen}
        config={config}
        artStyleId={project.artStyle}
        allowBackground
        onClose={() => setGenerateModalOpen(false)}
        onBackgroundSubmit={(values) =>
          startImageJob({
            projectId: project.id,
            projectName: project.name,
            artStyleId: project.artStyle,
            values,
            config,
            onWorkflowChange,
          })
        }
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
        artStyleId={project.artStyle}
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
