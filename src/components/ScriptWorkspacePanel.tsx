import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import type {
  ScriptGenerationProgress,
  ScriptPipelineStage,
} from "../agents/workflowAgent/scriptGeneration";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ScriptRecord, ScriptWorkData } from "../services/script";
import {
  formatAdaptationStrategyDisplay,
  formatStorySkeletonDisplay,
} from "../utils/xmlTags";
import { MarkdownContent } from "./MarkdownContent";
import { ScriptEpisodesTable } from "./ScriptEpisodesTable";

type WorkspaceTab = "skeleton" | "strategy" | "scripts";

interface ScriptWorkspacePanelProps {
  workData: ScriptWorkData;
  scripts: ScriptRecord[];
  hasFailedScripts: boolean;
  isGenerating: boolean;
  generationProgress: ScriptGenerationProgress | null;
  onRetryFailed: () => void;
}

export function ScriptWorkspacePanel({
  workData,
  scripts,
  hasFailedScripts,
  isGenerating,
  generationProgress,
  onRetryFailed,
}: ScriptWorkspacePanelProps) {
  const s = useTranslationMessages().creation.aiScriptStep;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("skeleton");

  useEffect(() => {
    if (!isGenerating || !generationProgress) return;
    setActiveTab(stageToTab(generationProgress.stage));
  }, [generationProgress, isGenerating]);

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
  const hasSkeleton = workData.storySkeleton.trim().length > 0;
  const hasStrategy = workData.adaptationStrategy.trim().length > 0;

  const skeletonLoading =
    isGenerating &&
    !hasSkeleton &&
    (!generationProgress || generationProgress.stage === "skeleton");
  const strategyLoading =
    isGenerating &&
    !hasStrategy &&
    generationProgress?.stage === "adaptation";
  const scriptsLoading =
    isGenerating &&
    !hasScripts &&
    generationProgress?.stage === "scripts";

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
          hasSkeleton ? (
            <div className="h-full min-w-0 overflow-auto text-sm text-text-muted">
              <MarkdownContent
                content={formatStorySkeletonDisplay(workData.storySkeleton)}
              />
            </div>
          ) : skeletonLoading ? (
            <WorkspaceLoading
              label={getStageLoadingLabel("skeleton", generationProgress, s)}
            />
          ) : (
            <EmptyHint text={s.tabSkeletonEmpty} />
          )
        ) : null}

        {activeTab === "strategy" ? (
          hasStrategy ? (
            <div className="h-full min-w-0 overflow-auto text-sm text-text-muted">
              <MarkdownContent
                content={formatAdaptationStrategyDisplay(
                  workData.adaptationStrategy,
                )}
              />
            </div>
          ) : strategyLoading ? (
            <WorkspaceLoading
              label={getStageLoadingLabel("strategy", generationProgress, s)}
            />
          ) : (
            <EmptyHint text={s.tabStrategyEmpty} />
          )
        ) : null}

        {activeTab === "scripts" ? (
          hasScripts ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <ScriptEpisodesTable scripts={scripts} labels={tableLabels} />
            </div>
          ) : scriptsLoading ? (
            <WorkspaceLoading
              label={getStageLoadingLabel("scripts", generationProgress, s)}
            />
          ) : (
            <EmptyHint text={s.emptyHint} />
          )
        ) : null}
      </div>
    </div>
  );
}

function stageToTab(stage: ScriptPipelineStage): WorkspaceTab {
  if (stage === "skeleton") return "skeleton";
  if (stage === "adaptation") return "strategy";
  return "scripts";
}

function getStageLoadingLabel(
  tab: WorkspaceTab,
  progress: ScriptGenerationProgress | null,
  labels: {
    generating: string;
    stageSkeleton: string;
    stageAdaptation: string;
    stageScripts: string;
    stageScriptsProgress: (completed: number, total: number) => string;
  },
): string {
  if (!progress) return labels.generating;

  if (tab === "skeleton") return labels.stageSkeleton;
  if (tab === "strategy") return labels.stageAdaptation;
  if (
    tab === "scripts" &&
    progress.completed != null &&
    progress.total != null
  ) {
    return labels.stageScriptsProgress(progress.completed, progress.total);
  }
  return labels.stageScripts;
}

function WorkspaceLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-4">
      <FontAwesomeIcon
        icon={faSpinner}
        className="text-xl text-accent animate-spin"
      />
      <p className="text-center text-sm text-text-muted">{label}</p>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center px-4">
      <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
        {text}
      </p>
    </div>
  );
}
