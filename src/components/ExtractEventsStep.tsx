import { useCallback, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileImport,
  faSpinner,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  extractEventsFromNovel,
  type ChapterEventResult,
} from "../services/eventExtraction";
import type { AppConfig } from "../types";
import { ImportNovelModal } from "./ImportNovelModal";

interface ExtractEventsStepProps {
  title: string;
  config: AppConfig;
  selectedModel: string;
  onConfigError: (message: string | null) => void;
}

export function ExtractEventsStep({
  title,
  config,
  selectedModel,
  onConfigError,
}: ExtractEventsStepProps) {
  const i18n = useTranslationMessages();
  const s = i18n.creation.extractEventsStep;
  const [importOpen, setImportOpen] = useState(false);
  const [novelText, setNovelText] = useState("");
  const [results, setResults] = useState<ChapterEventResult[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  const hasContent = novelText.trim().length > 0;
  const hasResults = results.length > 0;

  const handleImportConfirm = useCallback((content: string) => {
    abortRef.current?.abort();
    setNovelText(content);
    setResults([]);
    setProgress(null);
    setImportOpen(false);
  }, []);

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
    setResults([]);
    setProgress(null);

    try {
      const extracted = await extractEventsFromNovel(
        config,
        selectedModel,
        novelText,
        ({ completed, total, latest }) => {
          setProgress({ completed, total });
          if (latest) {
            setResults((prev) => {
              const next = [...prev];
              const idx = latest.chapter.index - 1;
              next[idx] = latest;
              return next
                .filter((item): item is ChapterEventResult => item != null)
                .sort((a, b) => a.chapter.index - b.chapter.index);
            });
          }
        },
        controller.signal,
      );
      setResults(extracted);
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
    novelText,
    onConfigError,
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
            disabled={extracting}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm text-white transition hover:border-accent/40 hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faFileImport} className="text-xs text-accent" />
            {s.importSource}
          </button>
          <button
            type="button"
            disabled={!hasContent || extracting}
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

      {hasContent ? (
        <div className="mt-6 shrink-0 rounded-xl border border-white/10 bg-surface/40 p-4">
          <p className="mb-3 text-xs text-text-muted">
            {novelText.length} {s.charsUnit}
          </p>
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
            {novelText}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex min-h-[160px] shrink-0 items-center justify-center rounded-xl border border-dashed border-white/10 bg-surface/20 px-6">
          <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
            {s.emptyHint}
          </p>
        </div>
      )}

      <div className="mt-6 flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/20">
        {extracting && !hasResults ? (
          <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3 px-6">
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
        ) : hasResults ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-text-muted">
                  <th className="sticky top-0 z-10 bg-[#141414] px-4 py-3 font-medium">
                    {s.colIndex}
                  </th>
                  <th className="sticky top-0 z-10 bg-[#141414] px-4 py-3 font-medium">
                    {s.colReel}
                  </th>
                  <th className="sticky top-0 z-10 bg-[#141414] px-4 py-3 font-medium">
                    {s.colChapter}
                  </th>
                  <th className="sticky top-0 z-10 bg-[#141414] px-4 py-3 font-medium">
                    {s.colContent}
                  </th>
                  <th className="sticky top-0 z-10 bg-[#141414] px-4 py-3 font-medium">
                    {s.colEvent}
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr
                    key={row.chapter.index}
                    className="border-b border-white/5 align-top last:border-0"
                  >
                    <td className="px-4 py-3 text-text-muted">{row.chapter.index}</td>
                    <td className="px-4 py-3 text-text-muted">{row.chapter.reel}</td>
                    <td className="px-4 py-3 text-white">{row.chapter.title}</td>
                    <td className="min-w-[180px] max-w-[280px] px-4 py-3 text-text-muted">
                      <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                        {row.chapter.content}
                      </div>
                    </td>
                    <td className="min-w-[240px] max-w-[420px] px-4 py-3">
                      {row.error ? (
                        <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-red-400 leading-relaxed">
                          {row.error}
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-white leading-relaxed">
                          {row.event || s.noEvent}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center px-6">
            <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
              {s.resultsEmpty}
            </p>
          </div>
        )}
      </div>

      <ImportNovelModal
        open={importOpen}
        initialContent={novelText}
        onClose={() => setImportOpen(false)}
        onConfirm={handleImportConfirm}
      />
    </div>
  );
}
