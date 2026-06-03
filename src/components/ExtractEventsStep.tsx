import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileImport,
  faSpinner,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import { extractEventsForChapters } from "../agents/workflowAgent/eventExtraction";
import {
  EVENT_STATE_SUCCESS,
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setExtractionDurationMs(initialExtractionDurationMs);
  }, [initialExtractionDurationMs]);

  const hasContent = chapters.length > 0;
  const hasResults = chapters.some(
    (chapter) => chapter.event || chapter.errorReason,
  );

  const handleImportConfirm = useCallback(
    async (content: string) => {
      abortRef.current?.abort();
      setImporting(true);
      onConfigError(null);
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
    if (!hasContent || extracting) return;

    if (!config.apiKey.trim() || !config.baseUrl.trim()) {
      onConfigError(i18n.errors.configRequired);
      return;
    }
    if (!selectedModel) {
      onConfigError(i18n.errors.modelsRequired);
      return;
    }

    onConfigError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setExtracting(true);
    setProgress(null);
    const startedAt = Date.now();

    try {
      const rows = await listNovelChapters(projectId);
      const hadPending = rows.some(
        (chapter) => chapter.eventState !== EVENT_STATE_SUCCESS,
      );
      const { chapters: extracted } = await extractEventsForChapters(
        config,
        selectedModel,
        rows,
        ({ completed, total, latest }) => {
          setProgress({ completed, total });
          if (latest) {
            setChapters((prev) =>
              prev.map((row) => (row.id === latest.id ? latest : row)),
            );
          }
        },
        controller.signal,
      );
      setChapters(extracted);

      if (hadPending && isEventExtractionComplete(extracted)) {
        const durationMs = Date.now() - startedAt;
        await setEventExtractionDuration(projectId, durationMs);
        const source = await getNovelSource(projectId);
        setExtractionDurationMs(source?.eventExtractionDurationMs ?? durationMs);
      }
      invalidateWorkflowCache(projectId);
      onWorkflowChange?.();
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        onConfigError(message);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setExtracting(false);
      setProgress(null);
    }
  }, [
    config,
    extracting,
    hasContent,
    i18n.errors.configRequired,
    i18n.errors.modelsRequired,
    onConfigError,
    onWorkflowChange,
    projectId,
    selectedModel,
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
          {extractionDurationMs != null ? (
            <span className="shrink-0 text-xs text-text-muted">
              {s.extractionDurationLabel}{" "}
              {s.formatDuration(extractionDurationMs)}
            </span>
          ) : null}
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
              : s.extractEvents}
          </button>
        </div>
      </div>

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
          {extracting && !hasResults ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
              <FontAwesomeIcon
                icon={faSpinner}
                className="text-xl text-accent animate-spin"
              />
              <p className="text-sm text-text-muted">
                {progress
                  ? s.extractingProgress(progress.completed, progress.total)
                  : s.extracting}
              </p>
            </div>
          ) : hasContent ? (
            <EventChaptersTable chapters={chapters} />
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
