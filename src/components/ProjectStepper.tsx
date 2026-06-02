import { Fragment } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import type {
  ProjectWorkflowNode,
  ProjectWorkflowStepId,
  WorkflowNodeStatus,
} from "../types";

export interface WorkflowStepItem {
  id: ProjectWorkflowStepId;
  label: string;
  status: WorkflowNodeStatus;
}

interface ProjectStepperProps {
  steps: WorkflowStepItem[];
  selectedStep: ProjectWorkflowStepId;
  onStepChange: (step: ProjectWorkflowStepId) => void;
}

type StepVisualState = "completed" | "current" | "notStarted";

function StepCircle({
  state,
  index,
}: {
  state: StepVisualState;
  index: number;
}) {
  return (
    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black">
      {state === "completed" && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-black shadow-[0_0_10px_rgba(0,255,102,0.4)] transition group-hover:shadow-[0_0_14px_rgba(0,255,102,0.55)]">
          <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
        </span>
      )}

      {state === "current" && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-[11px] font-semibold text-white ring-2 ring-cyan-300/40 transition group-hover:ring-cyan-200/60 [animation:step-glow_2.4s_ease-in-out_infinite]">
          {index + 1}
        </span>
      )}

      {state === "notStarted" && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/10 bg-[#0a0a0a] text-[11px] font-medium text-text-dim transition group-hover:border-white/25 group-hover:text-text-muted">
          {index + 1}
        </span>
      )}
    </span>
  );
}

type SegmentVariant = "full" | "transition" | "pending";

function getCurrentIndex(nodes: Pick<ProjectWorkflowNode, "status">[]): number {
  const index = nodes.findIndex((node) => node.status === "current");
  if (index === -1) {
    return nodes.length - 1;
  }
  return index;
}

function getSegmentVariant(
  index: number,
  nodes: Pick<ProjectWorkflowNode, "status">[],
): SegmentVariant {
  const currentIndex = getCurrentIndex(nodes);
  if (index <= currentIndex) return "full";
  if (index === currentIndex + 1) return "transition";
  return "pending";
}

function SegmentLine({ variant }: { variant: SegmentVariant }) {
  return (
    <div
      className="relative z-0 mt-4 h-px min-w-[1rem] flex-1 self-start -mx-2"
      aria-hidden
    >
      <div className="absolute inset-0 bg-white/10" />
      {variant === "full" && (
        <div className="absolute inset-0 bg-gradient-to-r from-accent/90 to-accent/55" />
      )}
      {variant === "transition" && (
        <div className="step-segment-transition absolute inset-0" />
      )}
    </div>
  );
}

function labelClass(state: StepVisualState): string {
  switch (state) {
    case "current":
      return "font-medium text-white";
    case "completed":
      return "text-accent/80 group-hover:text-accent";
    case "notStarted":
      return "text-text-dim group-hover:text-text-muted";
  }
}

export function ProjectStepper({
  steps,
  selectedStep,
  onStepChange,
}: ProjectStepperProps) {
  return (
    <div className="w-full min-w-0 overflow-visible px-1 pt-2 pb-1">
      <div
        role="navigation"
        aria-label="Project workflow"
        className="overflow-x-auto overflow-y-visible py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-full min-w-[36rem] items-start">
          {steps.map((step, index) => {
            const isSelected = step.id === selectedStep;
            const state = step.status;

            return (
              <Fragment key={step.id}>
                {index > 0 && (
                  <SegmentLine variant={getSegmentVariant(index, steps)} />
                )}
                <button
                  type="button"
                  onClick={() => onStepChange(step.id)}
                  aria-current={isSelected ? "step" : undefined}
                  className="group flex w-[4.75rem] shrink-0 flex-col items-center outline-none sm:w-[5.5rem]"
                >
                  <StepCircle state={state} index={index} />
                  <span
                    className={`mt-2 max-w-[5.5rem] px-0.5 text-center text-[10px] leading-tight transition sm:max-w-none sm:text-[11px] ${labelClass(state)}`}
                  >
                    {step.label}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
