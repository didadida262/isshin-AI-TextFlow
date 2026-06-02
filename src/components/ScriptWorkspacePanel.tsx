import { useState } from "react";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ScriptRecord, ScriptWorkData } from "../services/script";
import { MarkdownContent } from "./MarkdownContent";
import { ScriptEpisodesTable } from "./ScriptEpisodesTable";

type WorkspaceTab = "skeleton" | "strategy" | "scripts";

interface ScriptWorkspacePanelProps {
  workData: ScriptWorkData;
  scripts: ScriptRecord[];
  hasFailedScripts: boolean;
  isGenerating: boolean;
  onRetryFailed: () => void;
}

export function ScriptWorkspacePanel({
  workData,
  scripts,
  hasFailedScripts,
  isGenerating,
  onRetryFailed,
}: ScriptWorkspacePanelProps) {
  const s = useTranslationMessages().creation.aiScriptStep;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("skeleton");

  const tabs: { id: WorkspaceTab; label: string; badge?: boolean }[] = [
    { id: "skeleton", label: s.storySkeletonTitle },
    { id: "strategy", label: s.adaptationStrategyTitle },
    { id: "scripts", label: s.tabScripts, badge: hasFailedScripts },
  ];

  const tableLabels = {
    colEpisode: s.colEpisode,
    colName: s.colName,
    colStatus: s.colStatus,
    colContent: s.colContent,
    statusSuccess: s.statusSuccess,
    statusError: s.statusError,
    statusPending: s.statusPending,
    noContent: s.noContent,
  };

  const hasScripts = scripts.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/40">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 pt-3">
        <div className="flex min-w-0 gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition sm:text-sm ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-white"
                }`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                ) : null}
              </button>
            );
          })}
        </div>
        {activeTab === "scripts" && hasFailedScripts ? (
          <button
            type="button"
            disabled={isGenerating}
            onClick={onRetryFailed}
            className="shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s.retryFailed}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {activeTab === "skeleton" ? (
          workData.storySkeleton.trim() ? (
            <div className="h-full min-w-0 overflow-auto text-sm text-text-muted">
              <MarkdownContent content={workData.storySkeleton} />
            </div>
          ) : (
            <EmptyHint text={s.tabSkeletonEmpty} />
          )
        ) : null}

        {activeTab === "strategy" ? (
          workData.adaptationStrategy.trim() ? (
            <div className="h-full min-w-0 overflow-auto text-sm text-text-muted">
              <MarkdownContent content={workData.adaptationStrategy} />
            </div>
          ) : (
            <EmptyHint text={s.tabStrategyEmpty} />
          )
        ) : null}

        {activeTab === "scripts" ? (
          hasScripts ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <ScriptEpisodesTable scripts={scripts} labels={tableLabels} />
            </div>
          ) : (
            <EmptyHint text={s.emptyHint} />
          )
        ) : null}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center px-4">
      <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
        {text}
      </p>
    </div>
  );
}
