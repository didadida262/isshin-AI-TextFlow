import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  getProjectWorkflowNodeDetail,
  listProjectWorkflowNodes,
  type WorkflowNodeDetail,
} from "../services/workflow";
import type {
  AppConfig,
  CreationProject,
  ProjectWorkflowNode,
  ProjectWorkflowStepId,
} from "../types";
import { ProjectStepper, type WorkflowStepItem } from "./ProjectStepper";
import { ExtractEventsStep } from "./ExtractEventsStep";
import { AiScriptStep } from "./AiScriptStep";

interface ProjectDetailViewProps {
  project: CreationProject;
  config: AppConfig;
  selectedModel: string;
  onConfigError: (message: string | null) => void;
  onBack: () => void;
}

function mapWorkflowSteps(
  nodes: ProjectWorkflowNode[],
  labels: Record<ProjectWorkflowStepId, string>,
): WorkflowStepItem[] {
  return nodes.map((node) => ({
    id: node.id,
    label: labels[node.id],
    status: node.status,
  }));
}

export function ProjectDetailView({
  project,
  config,
  selectedModel,
  onConfigError,
  onBack,
}: ProjectDetailViewProps) {
  const i18n = useTranslationMessages();
  const w = i18n.creation.workflow;
  const [selectedStep, setSelectedStep] =
    useState<ProjectWorkflowStepId>("extractEvents");
  const [workflowNodesRaw, setWorkflowNodesRaw] = useState<ProjectWorkflowNode[]>(
    [],
  );
  const [nodeDetail, setNodeDetail] = useState<WorkflowNodeDetail | null>(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const workflowNodes = useMemo(
    () => mapWorkflowSteps(workflowNodesRaw, w),
    [workflowNodesRaw, w],
  );

  const loadNodeDetail = useCallback(
    async (nodeId: ProjectWorkflowStepId) => {
      setLoadingDetail(true);
      try {
        const detail = await getProjectWorkflowNodeDetail(project.id, nodeId);
        setNodeDetail(detail);
      } finally {
        setLoadingDetail(false);
      }
    },
    [project.id],
  );

  const refreshProjectWorkflow = useCallback(async () => {
    const nodes = await listProjectWorkflowNodes(project.id);
    setWorkflowNodesRaw(nodes);
    await loadNodeDetail(selectedStep);
  }, [project.id, selectedStep, loadNodeDetail]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoadingWorkflow(true);
      try {
        const nodes = await listProjectWorkflowNodes(project.id);
        if (cancelled) return;

        setWorkflowNodesRaw(nodes);

        const currentNode =
          nodes.find((node) => node.status === "current") ?? nodes[0];
        const initialStep = currentNode?.id ?? "extractEvents";
        setSelectedStep(initialStep);

        const detail = await getProjectWorkflowNodeDetail(
          project.id,
          initialStep,
        );
        if (!cancelled) {
          setNodeDetail(detail);
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkflow(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const handleStepChange = useCallback(
    (stepId: ProjectWorkflowStepId) => {
      setSelectedStep(stepId);
      void loadNodeDetail(stepId);
    },
    [loadNodeDetail],
  );

  const activeLabel = w[selectedStep];

  const extractEventsDetail = useMemo(
    () =>
      nodeDetail?.kind === "extractEvents" ? nodeDetail : null,
    [nodeDetail],
  );

  const aiScriptDetail = useMemo(
    () => (nodeDetail?.kind === "aiScript" ? nodeDetail : null),
    [nodeDetail],
  );

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black">
      <header className="shrink-0 overflow-visible px-6 pb-4 pt-5">
        <div className="mb-3 flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            title={i18n.creation.backToList}
            aria-label={i18n.creation.backToList}
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] py-0.5 pl-0.5 pr-2 ring-1 ring-white/10 transition hover:bg-white/[0.07] hover:ring-white/20"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-text-muted transition group-hover:text-white">
              <FontAwesomeIcon icon={faArrowLeft} className="text-[9px]" />
            </span>
            <span className="text-[11px] font-medium text-text-muted transition group-hover:text-white">
              {i18n.creation.backShort}
            </span>
          </button>

          <span className="h-3 w-px shrink-0 bg-white/10" aria-hidden />

          <p className="min-w-0 truncate text-sm font-semibold text-white">
            {project.name}
          </p>
        </div>

        {!loadingWorkflow && workflowNodes.length > 0 ? (
          <ProjectStepper
            steps={workflowNodes}
            selectedStep={selectedStep}
            onStepChange={handleStepChange}
          />
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-1">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/20">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
            {loadingWorkflow || loadingDetail ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-text-muted">{w.loading}</p>
              </div>
            ) : selectedStep === "extractEvents" && extractEventsDetail ? (
              <ExtractEventsStep
                key={`${project.id}-${extractEventsDetail.chapters.length}-${extractEventsDetail.source?.importedAt ?? 0}`}
                projectId={project.id}
                title={activeLabel}
                config={config}
                selectedModel={selectedModel}
                onConfigError={onConfigError}
                initialSource={extractEventsDetail.source}
                initialChapters={extractEventsDetail.chapters}
                onWorkflowChange={() => void refreshProjectWorkflow()}
              />
            ) : selectedStep === "aiScript" && aiScriptDetail ? (
              <AiScriptStep
                key={`${project.id}-ai-script-${aiScriptDetail.scripts.length}`}
                project={project}
                title={activeLabel}
                config={config}
                selectedModel={selectedModel}
                chapters={aiScriptDetail.chapters}
                workData={aiScriptDetail.workData}
                scripts={aiScriptDetail.scripts}
                onConfigError={onConfigError}
                onWorkflowChange={() => void refreshProjectWorkflow()}
                onScriptsUpdated={() => void loadNodeDetail("aiScript")}
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <h2 key={selectedStep} className="step-panel-title">
                  {activeLabel}
                </h2>
                <div className="mt-6 flex min-h-[280px] flex-1 items-center justify-center">
                  <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
                    {w.placeholder}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
