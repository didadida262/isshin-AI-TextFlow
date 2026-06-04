import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  getProjectWorkflowNodeDetail,
  invalidateWorkflowCache,
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
import { GenerateAssetsStep } from "./GenerateAssetsStep";
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

const STEP_ORDER: ProjectWorkflowStepId[] = [
  "extractEvents",
  "aiScript",
  "generateAssets",
  "storyboard",
  "generateVideo",
  "editExport",
];

const stepTransition = {
  type: "tween" as const,
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

const stepPanelVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction > 0 ? 32 : -32,
    filter: "blur(6px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction > 0 ? -32 : 32,
    filter: "blur(6px)",
  }),
};

function StepPanelLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-3">
      <FontAwesomeIcon
        icon={faSpinner}
        className="text-xl text-accent animate-spin"
      />
      <p className="text-sm text-text-muted">{label}</p>
    </div>
  );
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
  const [loadedStep, setLoadedStep] = useState<ProjectWorkflowStepId | null>(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stepDirection, setStepDirection] = useState(0);
  const [enableStepAnimation, setEnableStepAnimation] = useState(false);

  const workflowNodes = useMemo(
    () => mapWorkflowSteps(workflowNodesRaw, w),
    [workflowNodesRaw, w],
  );

  const loadNodeDetail = useCallback(
    async (
      nodeId: ProjectWorkflowStepId,
      options?: { silent?: boolean },
    ) => {
      if (!options?.silent) {
        setLoadingDetail(true);
      }
      try {
        const detail = await getProjectWorkflowNodeDetail(project.id, nodeId);
        setNodeDetail(detail);
        setLoadedStep(nodeId);
      } finally {
        if (!options?.silent) {
          setLoadingDetail(false);
        }
      }
    },
    [project.id],
  );

  const refreshProjectWorkflow = useCallback(async () => {
    invalidateWorkflowCache(project.id);
    const nodes = await listProjectWorkflowNodes(project.id);
    setWorkflowNodesRaw(nodes);
    invalidateWorkflowCache(project.id, selectedStep);
    await loadNodeDetail(selectedStep, { silent: true });
  }, [project.id, selectedStep, loadNodeDetail]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoadingWorkflow(true);
      try {
        invalidateWorkflowCache(project.id);
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
          setLoadedStep(initialStep);
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
      if (stepId === selectedStep) return;

      const prevIndex = STEP_ORDER.indexOf(selectedStep);
      const nextIndex = STEP_ORDER.indexOf(stepId);
      setStepDirection(nextIndex >= prevIndex ? 1 : -1);
      setEnableStepAnimation(true);
      setSelectedStep(stepId);
      setLoadingDetail(true);
      invalidateWorkflowCache(project.id, stepId);
      void loadNodeDetail(stepId);
    },
    [loadNodeDetail, project.id, selectedStep],
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

  const generateAssetsDetail = useMemo(
    () => (nodeDetail?.kind === "generateAssets" ? nodeDetail : null),
    [nodeDetail],
  );

  const isStepContentLoading =
    loadingDetail || loadedStep !== selectedStep;

  const stepPanel = useMemo(() => {
    if (selectedStep === "extractEvents" && extractEventsDetail) {
      return (
        <ExtractEventsStep
          key={`${project.id}-${extractEventsDetail.chapters.length}-${extractEventsDetail.source?.importedAt ?? 0}`}
          projectId={project.id}
          title={activeLabel}
          config={config}
          selectedModel={selectedModel}
          onConfigError={onConfigError}
          initialSource={extractEventsDetail.source}
          initialChapters={extractEventsDetail.chapters}
          initialExtractionDurationMs={
            extractEventsDetail.source?.eventExtractionDurationMs ?? null
          }
          onWorkflowChange={() => void refreshProjectWorkflow()}
        />
      );
    }

    if (selectedStep === "aiScript" && aiScriptDetail) {
      return (
        <AiScriptStep
          key={`${project.id}-ai-script`}
          project={project}
          title={activeLabel}
          config={config}
          selectedModel={selectedModel}
          chapters={aiScriptDetail.chapters}
          workData={aiScriptDetail.workData}
          scripts={aiScriptDetail.scripts}
          onConfigError={onConfigError}
          onWorkflowChange={() => void refreshProjectWorkflow()}
          onScriptsUpdated={() => void loadNodeDetail("aiScript", { silent: true })}
        />
      );
    }

    if (selectedStep === "generateAssets" && generateAssetsDetail) {
      return (
        <GenerateAssetsStep
          key={`${project.id}-assets-${generateAssetsDetail.assets.total}-${generateAssetsDetail.assets.items[0]?.id ?? 0}`}
          project={project}
          title={activeLabel}
          config={config}
          initialAssets={generateAssetsDetail.assets}
          onConfigError={onConfigError}
        />
      );
    }

    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="step-panel-title">{activeLabel}</h2>
        <div className="mt-6 flex min-h-[280px] flex-1 items-center justify-center">
          <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
            {w.placeholder}
          </p>
        </div>
      </div>
    );
  }, [
    activeLabel,
    aiScriptDetail,
    config,
    extractEventsDetail,
    generateAssetsDetail,
    loadNodeDetail,
    onConfigError,
    project,
    refreshProjectWorkflow,
    selectedModel,
    selectedStep,
    w.loading,
    w.placeholder,
  ]);

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
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-5">
            {loadingWorkflow || isStepContentLoading ? (
              <StepPanelLoading label={w.loading} />
            ) : (
              <AnimatePresence mode="wait" custom={stepDirection}>
                <motion.div
                  key={selectedStep}
                  custom={stepDirection}
                  variants={stepPanelVariants}
                  initial={enableStepAnimation ? "enter" : false}
                  animate="center"
                  exit="exit"
                  transition={stepTransition}
                  className="flex min-h-0 flex-1 flex-col will-change-[transform,opacity,filter]"
                >
                  {stepPanel}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
