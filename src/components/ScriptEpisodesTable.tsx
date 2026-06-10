import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import type { ScriptGenerationProgress } from "../agents/workflowAgent/scriptGeneration";
import type { NovelChapterRecord } from "../services/novel";
import type { ScriptRecord } from "../services/script";
import {
  SCRIPT_STATE_ERROR,
  SCRIPT_STATE_SUCCESS,
} from "../services/script";
import { ScriptEpisodeDetailModal } from "./ScriptEpisodeDetailModal";

interface ScriptEpisodesTableProps {
  scripts: ScriptRecord[];
  chapters: NovelChapterRecord[];
  isGenerating: boolean;
  generationProgress: ScriptGenerationProgress | null;
  labels: {
    colEpisode: string;
    colName: string;
    colStatus: string;
    colContent: string;
    statusSuccess: string;
    statusError: string;
    statusPending: string;
    generatingRowScript: string;
    noContent: string;
  };
}

type ScriptRow = {
  kind: "script";
  script: ScriptRecord;
  isRetryLoading?: boolean;
};

type PlaceholderRow = {
  kind: "placeholder";
  episodeIndex: number;
  name: string;
  loading: "active" | "waiting";
};

type DisplayRow = ScriptRow | PlaceholderRow;

function statusLabel(
  script: ScriptRecord,
  labels: ScriptEpisodesTableProps["labels"],
  isRetryLoading = false,
): string {
  if (isRetryLoading) return labels.generatingRowScript;
  if (script.scriptState === SCRIPT_STATE_SUCCESS) return labels.statusSuccess;
  if (script.scriptState === SCRIPT_STATE_ERROR) return labels.statusError;
  return labels.statusPending;
}

function statusClass(
  script: ScriptRecord,
  isRetryLoading = false,
): string {
  if (isRetryLoading) return "text-text-muted";
  if (script.scriptState === SCRIPT_STATE_SUCCESS) return "text-accent";
  if (script.scriptState === SCRIPT_STATE_ERROR) return "text-red-400";
  return "text-text-dim";
}

function previewText(
  script: ScriptRecord,
  labels: ScriptEpisodesTableProps["labels"],
  isRetryLoading = false,
): string {
  if (isRetryLoading) return labels.generatingRowScript;
  if (script.scriptState === SCRIPT_STATE_ERROR) {
    return script.errorReason ?? labels.statusError;
  }
  if (script.content) {
    return script.content.replace(/\s+/g, " ").trim();
  }
  return labels.noContent;
}

function buildDisplayRows(
  scripts: ScriptRecord[],
  chapters: NovelChapterRecord[],
  isGenerating: boolean,
  generationProgress: ScriptGenerationProgress | null,
): DisplayRow[] {
  const sortedScripts = [...scripts].sort(
    (a, b) => a.episodeIndex - b.episodeIndex,
  );

  if (
    !isGenerating ||
    generationProgress?.stage !== "scripts" ||
    generationProgress.total == null ||
    generationProgress.total <= 0
  ) {
    return sortedScripts.map((script) => ({ kind: "script", script }));
  }

  const completed = generationProgress.completed ?? 0;
  const total = generationProgress.total;

  if (total === chapters.length) {
    const sortedChapters = [...chapters].sort(
      (a, b) => a.chapterIndex - b.chapterIndex,
    );
    const scriptByEpisode = new Map(
      sortedScripts.map((script) => [script.episodeIndex, script]),
    );

    return sortedChapters.map((chapter, index) => {
      const script = scriptByEpisode.get(chapter.chapterIndex);
      if (script) return { kind: "script", script };

      return {
        kind: "placeholder",
        episodeIndex: chapter.chapterIndex,
        name: chapter.chapter,
        loading: index === completed ? "active" : "waiting",
      };
    });
  }

  const failedScripts = sortedScripts.filter(
    (script) => script.scriptState === SCRIPT_STATE_ERROR,
  );
  const loadingEpisodeIndex =
    completed < total ? failedScripts[completed]?.episodeIndex : undefined;

  return sortedScripts.map((script) => ({
    kind: "script",
    script,
    isRetryLoading: script.episodeIndex === loadingEpisodeIndex,
  }));
}

function LoadingCell({
  label,
  muted = false,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 ${
        muted ? "text-text-dim" : "text-text-muted"
      }`}
    >
      <FontAwesomeIcon
        icon={faSpinner}
        className="shrink-0 text-xs text-accent animate-spin"
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

const colgroup = (
  <colgroup>
    <col className="w-14" />
    <col className="w-44 sm:w-52" />
    <col className="w-20" />
    <col />
  </colgroup>
);

export function ScriptEpisodesTable({
  scripts,
  chapters,
  isGenerating,
  generationProgress,
  labels,
}: ScriptEpisodesTableProps) {
  const [detailScript, setDetailScript] = useState<ScriptRecord | null>(null);
  const rows = buildDisplayRows(
    scripts,
    chapters,
    isGenerating,
    generationProgress,
  );

  if (rows.length === 0) return null;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          {colgroup}
          <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
            <tr className="border-b border-white/10 text-text-muted">
              <th className="px-3 py-2.5 font-medium">{labels.colEpisode}</th>
              <th className="px-3 py-2.5 font-medium">{labels.colName}</th>
              <th className="px-3 py-2.5 font-medium">{labels.colStatus}</th>
              <th className="px-3 py-2.5 font-medium">{labels.colContent}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === "placeholder") {
                const statusText =
                  row.loading === "active"
                    ? labels.generatingRowScript
                    : labels.statusPending;

                return (
                  <tr
                    key={`placeholder-${row.episodeIndex}`}
                    className="border-b border-white/5 align-top"
                  >
                    <td className="px-3 py-2.5 text-text-muted">
                      {row.episodeIndex}
                    </td>
                    <td className="max-w-0 px-3 py-2.5 text-text-dim">
                      <p className="truncate" title={row.name}>
                        {row.name}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <LoadingCell
                        label={statusText}
                        muted={row.loading === "waiting"}
                      />
                    </td>
                    <td className="max-w-0 px-3 py-2.5 text-text-dim">—</td>
                  </tr>
                );
              }

              const { script, isRetryLoading = false } = row;
              const contentPreview = previewText(script, labels, isRetryLoading);
              const clickable = !isRetryLoading;

              return (
                <tr
                  key={script.id}
                  className={`border-b border-white/5 align-top transition ${
                    clickable
                      ? "cursor-pointer hover:bg-white/[0.02]"
                      : ""
                  }`}
                  onClick={() => {
                    if (clickable) setDetailScript(script);
                  }}
                >
                  <td className="px-3 py-2.5 text-text-muted">
                    {script.episodeIndex}
                  </td>
                  <td className="max-w-0 px-3 py-2.5 text-white">
                    <p className="truncate" title={script.name}>
                      {script.name}
                    </p>
                  </td>
                  <td className={`px-3 py-2.5 ${statusClass(script, isRetryLoading)}`}>
                    {isRetryLoading ? (
                      <LoadingCell label={labels.generatingRowScript} />
                    ) : (
                      statusLabel(script, labels, isRetryLoading)
                    )}
                  </td>
                  <td className="max-w-0 px-3 py-2.5 text-text-muted">
                    {isRetryLoading ? (
                      <span className="text-text-dim">—</span>
                    ) : (
                      <p
                        className={`truncate ${
                          script.scriptState === SCRIPT_STATE_ERROR
                            ? "text-red-400/90"
                            : ""
                        }`}
                      >
                        {contentPreview}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ScriptEpisodeDetailModal
        script={detailScript}
        onClose={() => setDetailScript(null)}
      />
    </>
  );
}
