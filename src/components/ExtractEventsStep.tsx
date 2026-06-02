import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileImport,
  faSpinner,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import { extractEventsForChapters } from "../services/eventExtraction";
import {
  getNovelSource,
  importNovel,
  listNovelChapters,
  type NovelChapterRecord,
} from "../services/novel";
import type { AppConfig } from "../types";
import { ImportNovelModal } from "./ImportNovelModal";
import { HoverFullText } from "./HoverFullText";

interface ExtractEventsStepProps {
  projectId: string;
  title: string;
  config: AppConfig;
  selectedModel: string;
  onConfigError: (message: string | null) => void;
}

export function ExtractEventsStep({
  projectId,
  title,
  config,
  selectedModel,
  onConfigError,
}: ExtractEventsStepProps) {
  const i18n = useTranslationMessages();
  const s = i18n.creation.extractEventsStep;
  const [importOpen, setImportOpen] = useState(false);
  const [novelText, setNovelText] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [chapters, setChapters] = useState<NovelChapterRecord[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  const hasContent = chapters.length > 0;
  const hasResults = chapters.some(
    (chapter) => chapter.event || chapter.errorReason,
  );

  const reloadNovel = useCallback(async () => {
    const [source, rows] = await Promise.all([
      getNovelSource(projectId),
      listNovelChapters(projectId),
    ]);
    setNovelText(source?.sourceText ?? "");
    setCharCount(source?.charCount ?? 0);
    setChapters(rows);
  }, [projectId]);

  useEffect(() => {
    void reloadNovel();
  }, [reloadNovel]);

  const handleImportConfirm = useCallback(
    async (content: string) => {
      abortRef.current?.abort();
      setImporting(true);
      onConfigError(null);
      try {
        await importNovel(projectId, content);
        await reloadNovel();
        setImportOpen(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onConfigError(message);
      } finally {
        setImporting(false);
      }
    },
    [onConfigError, projectId, reloadNovel],
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

    try {
      const rows = await listNovelChapters(projectId);
      const extracted = await extractEventsForChapters(
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
      void reloadNovel();
    }
  }, [
    config,
    extracting,
    hasContent,
    i18n.errors.configRequired,
    i18n.errors.modelsRequired,
    onConfigError,
    projectId,
    reloadNovel,
    selectedModel,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h2 className="step-panel-title min-w-0 shrink">{title}</h2>
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 overflow-x-auto border-b border-white/10">
                <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-14" />
                    <col className="w-24" />
                    <col className="w-28" />
                    <col className="w-[280px]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="text-xs text-text-muted">
                      <th className="px-4 py-3 font-medium">{s.colIndex}</th>
                      <th className="px-4 py-3 font-medium">{s.colReel}</th>
                      <th className="px-4 py-3 font-medium">{s.colChapter}</th>
                      <th className="px-4 py-3 font-medium">{s.colContent}</th>
                      <th className="px-4 py-3 font-medium">{s.colEvent}</th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-14" />
                    <col className="w-24" />
                    <col className="w-28" />
                    <col className="w-[280px]" />
                    <col />
                  </colgroup>
                  <tbody>
                    {chapters.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-white/5 align-top last:border-0"
                      >
                        <td className="px-4 py-3 text-text-muted">
                          {row.chapterIndex}
                        </td>
                        <td className="px-4 py-3 text-text-muted">{row.reel}</td>
                        <td className="px-4 py-3 text-white">{row.chapter}</td>
                        <td className="max-w-0 overflow-hidden px-4 py-3 text-text-muted">
                          <HoverFullText
                            text={row.chapterData}
                            className="text-text-muted"
                            lines={2}
                          />
                        </td>
                        <td className="max-w-0 overflow-hidden px-4 py-3">
                          {row.errorReason ? (
                            <HoverFullText
                              text={row.errorReason}
                              className="text-red-400"
                              lines={2}
                            />
                          ) : (
                            <HoverFullText
                              text={row.event || s.noEvent}
                              className="text-white"
                              lines={2}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
