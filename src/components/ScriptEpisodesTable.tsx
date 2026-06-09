import { useState } from "react";
import type { ScriptRecord } from "../services/script";
import { SCRIPT_STATE_ERROR, SCRIPT_STATE_SUCCESS } from "../services/script";
import { ScriptEpisodeDetailModal } from "./ScriptEpisodeDetailModal";

interface ScriptEpisodesTableProps {
  scripts: ScriptRecord[];
  labels: {
    colEpisode: string;
    colName: string;
    colStatus: string;
    colContent: string;
    statusSuccess: string;
    statusError: string;
    statusPending: string;
    noContent: string;
  };
}

function statusLabel(
  script: ScriptRecord,
  labels: ScriptEpisodesTableProps["labels"],
): string {
  if (script.scriptState === SCRIPT_STATE_SUCCESS) return labels.statusSuccess;
  if (script.scriptState === SCRIPT_STATE_ERROR) return labels.statusError;
  return labels.statusPending;
}

function statusClass(script: ScriptRecord): string {
  if (script.scriptState === SCRIPT_STATE_SUCCESS) return "text-accent";
  if (script.scriptState === SCRIPT_STATE_ERROR) return "text-red-400";
  return "text-text-dim";
}

function previewText(script: ScriptRecord, labels: ScriptEpisodesTableProps["labels"]): string {
  if (script.scriptState === SCRIPT_STATE_ERROR) {
    return script.errorReason ?? labels.statusError;
  }
  if (script.content) {
    return script.content.replace(/\s+/g, " ").trim();
  }
  return labels.noContent;
}

const colgroup = (
  <colgroup>
    <col className="w-14" />
    <col className="w-44 sm:w-52" />
    <col className="w-20" />
    <col />
  </colgroup>
);

export function ScriptEpisodesTable({ scripts, labels }: ScriptEpisodesTableProps) {
  const [detailScript, setDetailScript] = useState<ScriptRecord | null>(null);

  if (scripts.length === 0) return null;

  const sorted = [...scripts].sort((a, b) => a.episodeIndex - b.episodeIndex);

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
            {sorted.map((script) => {
              const contentPreview = previewText(script, labels);

              return (
                <tr
                  key={script.id}
                  className="border-b border-white/5 cursor-pointer align-top transition hover:bg-white/[0.02]"
                  onClick={() => setDetailScript(script)}
                >
                  <td className="px-3 py-2.5 text-text-muted">
                    {script.episodeIndex}
                  </td>
                  <td className="max-w-0 px-3 py-2.5 text-white">
                    <p className="truncate" title={script.name}>
                      {script.name}
                    </p>
                  </td>
                  <td className={`px-3 py-2.5 ${statusClass(script)}`}>
                    {statusLabel(script, labels)}
                  </td>
                  <td className="max-w-0 px-3 py-2.5 text-text-muted">
                    <p
                      className={`truncate ${
                        script.scriptState === SCRIPT_STATE_ERROR
                          ? "text-red-400/90"
                          : ""
                      }`}
                    >
                      {contentPreview}
                    </p>
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
