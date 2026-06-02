import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { CreationProject, ProjectWorkflowStepId } from "../types";
import { ProjectStepper, type WorkflowStepItem } from "./ProjectStepper";

interface ProjectDetailViewProps {
  project: CreationProject;
  onBack: () => void;
}

const STEP_ORDER: ProjectWorkflowStepId[] = [
  "extractEvents",
  "aiScript",
  "generateAssets",
  "storyboard",
  "generateVideo",
  "editExport",
];

export function ProjectDetailView({ project, onBack }: ProjectDetailViewProps) {
  const i18n = useTranslationMessages();
  const w = i18n.creation.workflow;
  const [activeStep, setActiveStep] =
    useState<ProjectWorkflowStepId>("extractEvents");

  const steps = useMemo<WorkflowStepItem[]>(
    () =>
      STEP_ORDER.map((id) => ({
        id,
        label: w[id],
      })),
    [w],
  );

  const activeLabel = w[activeStep];

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col bg-black">
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

        <ProjectStepper
          steps={steps}
          activeStep={activeStep}
          onStepChange={setActiveStep}
        />
      </header>

      <div className="mx-6 h-px shrink-0 bg-white/10" aria-hidden />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <h2 className="text-lg font-semibold text-white">{activeLabel}</h2>

        <div className="mt-6 flex min-h-[280px] flex-1 items-center justify-center">
          <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
            {w.placeholder}
          </p>
        </div>
      </div>
    </main>
  );
}
