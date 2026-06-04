import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faFileImport,
  faSpinner,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import { extractEventsForChapters } from "../agents/workflowAgent/eventExtraction";
import {
  beginEventExtraction,
  clearNovelEventExtraction,
  endEventExtractionInProgress,
  getNovelSource,
  importNovel,
  isEventExtractionComplete,
  listNovelChapters,
  setEventExtractionDuration,
  type NovelChapterRecord,
  type NovelSourceRecord,
} from "../services/novel";
import { invalidateWorkflowCache } from "../services/workflow";
import type { AppConfig } from "../types";
import { ImportNovelModal } from "./ImportNovelModal";
import { EventChaptersTable } from "./EventChaptersTable";

interface ExtractEventsStepProps {
  projectId: string;
  title: string;
  config: AppConfig;
  selectedModel: string;
  initialSource: NovelSourceRecord | null;
  initialChapters: NovelChapterRecord[];
  initialExtractionDurationMs: number | null;
  onConfigError: (message: string | null) => void;
  onWorkflowChange?: () => void;
}

export function ExtractEventsStep({
  projectId,
  title,
  config,
  selectedModel,
  initialSource,
  initialChapters,
  initialExtractionDurationMs,
  onConfigError,
  onWorkflowChange,
}: ExtractEventsStepProps) {
  const i18n = useTranslationMessages();
  const s = i18n.creation.extractEventsStep;
  const [importOpen, setImportOpen] = useState(false);
  const [novelText] = useState(initialSource?.sourceText ?? "");
  const [charCount] = useState(initialSource?.charCount ?? 0);
  const [chapters, setChapters] = useState(initialChapters);
  const [extractionDurationMs, setExtractionDurationMs] = useState(
    initialExtractionDurationMs,
  );
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const [loadingChapterIds, setLoadingChapterIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [scrollToChapterId, setScrollToChapterId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const extractingRef = useRef(false);
  const extractionStartedAtRef = useRef<number | null>(null);
  const [liveElapsedMs, setLiveElapsedMs] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (extractingRef.current) return;
    setChapters(initialChapters);
  }, [initialChapters]);

  useEffect(() => {
    setExtractionDurationMs(initialExtractionDurationMs);
  }, [initialSource?.importedAt, initialExtractionDurationMs]);

  useEffect(() => {
    let cancelled = false;
    void getNovelSource(projectId).then((source) => {
      if (cancelled) return;
      const fromDb = source?.eventExtractionDurationMs;
      if (fromDb != null) {
        setExtractionDurationMs(fromDb);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, initialSource?.importedAt]);

  useEffect(() => {
    if (!extracting) {
      setLiveElapsedMs(null);
      return;
    }
    const startedAt = extractionStartedAtRef.current ?? Date.now();
    const tick = () => setLiveElapsedMs(Math.max(0, Date.now() - startedAt));
    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [extracting]);

  const displayedDurationMs = extracting
    ? (liveElapsedMs ?? 0)
    : extractionDurationMs;

  const hasContent = chapters.length > 0;
  const extractionComplete = isEventExtractionComplete(chapters);
  const showDurationTip =
    extracting || (extractionComplete && displayedDurationMs != null);
  const durationTipLabel =
    displayedDurationMs != null
      ? s.extractionDurationTip(s.formatDuration(displayedDurationMs))
      : null;

  const validateExtractConfig = useCallback((): string | null => {
    const model = selectedModel.trim() || config.models[0]?.trim() || "";
    if (!config.apiKey.trim() || !config.baseUrl.trim()) {
      return i18n.errors.configRequired;
    }
    if (!model) {
      return i18n.errors.modelsRequired;
    }
    return null;
  }, [
    config.apiKey,
    config.baseUrl,
    config.models,
    i18n.errors.configRequired,
    i18n.errors.modelsRequired,
    selectedModel,
  ]);

  const performExtraction = useCallback(
    async (prefetchedRows?: NovelChapterRecord[]) => {
      const model = selectedModel.trim() || config.models[0]?.trim() || "";
      setActionError(null);
      onConfigError(null);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      extractingRef.current = true;

      setExtracting(true);
      setProgress(null);
      setLoadingChapterIds(new Set());
      setScrollToChapterId(null);
      setLiveElapsedMs(0);
      const startedAt = Date.now();
      extractionStartedAtRef.current = startedAt;

      let durationMs = 0;
      try {
        await beginEventExtraction(projectId);
        onWorkflowChange?.();

        const rows = prefetchedRows ?? (await listNovelChapters(projectId));
        setChapters(rows);
        const { chapters: extracted } = await extractEventsForChapters(
          config,
          model,
          rows,
          ({ completed, total, startedChapterId, latest }) => {
            setProgress({ completed, total });
            if (startedChapterId) {
              setLoadingChapterIds((prev) => {
                const next = new Set(prev);
                next.add(startedChapterId);
                return next;
              });
            }
            if (latest) {
              setLoadingChapterIds((prev) => {
                const next = new Set(prev);
                next.delete(latest.id);
                return next;
              });
              setChapters((prev) =>
                prev.map((row) => (row.id === latest.id ? latest : row)),
              );
              setScrollToChapterId(latest.id);
            }
          },
          controller.signal,
        );
        setChapters(extracted);
        durationMs = Math.max(0, Date.now() - startedAt);
        await setEventExtractionDuration(projectId, durationMs);
        const source = await getNovelSource(projectId);
        setExtractionDurationMs(source?.eventExtractionDurationMs ?? durationMs);
        invalidateWorkflowCache(projectId);
        onWorkflowChange?.();
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : String(error);
          setActionError(message);
          onConfigError(message);
          durationMs = Math.max(0, Date.now() - startedAt);
          try {
            await setEventExtractionDuration(projectId, durationMs);
            setExtractionDurationMs(durationMs);
          } catch {
            setExtractionDurationMs(durationMs);
          }
        }
      } finally {
        if (controller.signal.aborted) {
          try {
            await endEventExtractionInProgress(projectId);
            onWorkflowChange?.();
          } catch {
            /* ignore cleanup errors */
          }
        }
        extractingRef.current = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setExtracting(false);
        setProgress(null);
        setLoadingChapterIds(new Set());
        if (!controller.signal.aborted && durationMs > 0) {
          setExtractionDurationMs((current) => current ?? durationMs);
        }
      }
    },
    [config, onConfigError, onWorkflowChange, projectId, selectedModel],
  );

  const handleImportConfirm = useCallback(
    async (content: string) => {
      abortRef.current?.abort();
      setImporting(true);
      onConfigError(null);
      setActionError(null);
      try {
        await importNovel(projectId, content);
        setExtractionDurationMs(null);
        setImportOpen(false);
        onWorkflowChange?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onConfigError(message);
      } finally {
        setImporting(false);
      }
    },
    [onConfigError, onWorkflowChange, projectId],
  );

  const handleExtract = useCallback(async () => {
    if (!hasContent || extractingRef.current) return;
    const configError = validateExtractConfig();
    if (configError) {
      setActionError(configError);
      onConfigError(configError);
      return;
    }
    await performExtraction();
  }, [
    hasContent,
    onConfigError,
    performExtraction,
    validateExtractConfig,
  ]);

  const handleReExtract = useCallback(async () => {
    if (!hasContent || extractingRef.current) return;
    const configError = validateExtractConfig();
    if (configError) {
      setActionError(configError);
      onConfigError(configError);
      return;
    }

    setActionError(null);
    onConfigError(null);
    abortRef.current?.abort();

    try {
      await clearNovelEventExtraction(projectId);
      const rows = await listNovelChapters(projectId);
      setChapters(rows);
      setExtractionDurationMs(null);
      invalidateWorkflowCache(projectId);
      onWorkflowChange?.();
      await performExtraction(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionError(message);
      onConfigError(message);
    }
  }, [
    hasContent,
    onConfigError,
    onWorkflowChange,
    performExtraction,
    projectId,
    validateExtractConfig,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h2 className="step-panel-title w-fit min-w-0 shrink self-start">{title}</h2>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={extracting || importing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm text-white transition hover:border-accent/40 hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faFileImport} className="text-xs text-accent" />
            {s.importSource}
          </button>
          {extractionComplete && !extracting ? (
            <button
              type="button"
              disabled={!hasContent || importing}
              onClick={() => void handleReExtract()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm text-white transition hover:border-accent/40 hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FontAwesomeIcon icon={faArrowsRotate} className="text-xs text-accent" />
              {s.reExtractEvents}
            </button>
          ) : (
            <button
              type="button"
              disabled={!hasContent || extracting || importing}
              onClick={() => void handleExtract()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FontAwesomeIcon
                icon={extracting ? faSpinner : faWandMagicSparkles}
                className={`text-xs ${extracting ? "animate-spin" : ""}`}
              />
              {extracting && progress
                ? s.extractingProgress(progress.completed, progress.total)
                : extracting
                  ? s.extracting
                  : s.extractEvents}
            </button>
          )}
          {showDurationTip && durationTipLabel ? (
            <span className="inline-flex shrink-0 items-center rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm text-text-muted">
              {durationTipLabel}
            </span>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <p className="mt-3 shrink-0 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      ) : null}

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6">
        {hasContent ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/40 p-4">
            <p className="mb-3 shrink-0 text-xs text-text-muted">
              {charCount} {s.charsUnit}
              {chapters.length > 0
                ? ` · ${s.chapterCount(chapters.length)}`
                : null}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
              {novelText}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 bg-surface/20 px-6">
            <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
              {s.emptyHint}
            </p>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/20">
          {hasContent ? (
            <EventChaptersTable
              chapters={chapters}
              loadingChapterIds={loadingChapterIds}
              scrollToChapterId={scrollToChapterId}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
              <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
                {s.resultsEmpty}
              </p>
            </div>
          )}
        </div>
      </div>

      <ImportNovelModal
        open={importOpen}
        initialContent={novelText}
        onClose={() => setImportOpen(false)}
        onConfirm={(content) => void handleImportConfirm(content)}
      />
    </div>
  );
}
