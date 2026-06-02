import { Fragment } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import type { ProjectWorkflowStepId } from "../types";

export interface WorkflowStepItem {
  id: ProjectWorkflowStepId;
  label: string;
}

interface ProjectStepperProps {
  steps: WorkflowStepItem[];
  activeStep: ProjectWorkflowStepId;
  onStepChange: (step: ProjectWorkflowStepId) => void;
}

type StepVisualState = "completed" | "active" | "pending";

function getStepState(
  index: number,
  activeIndex: number,
): StepVisualState {
  if (index < activeIndex) return "completed";
  if (index === activeIndex) return "active";
  return "pending";
}

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

      {state === "active" && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-[11px] font-semibold text-white ring-2 ring-cyan-300/40 transition group-hover:ring-cyan-200/60 [animation:step-glow_2.4s_ease-in-out_infinite]">
          {index + 1}
        </span>
      )}

      {state === "pending" && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/15 bg-[#0a0a0a] text-[11px] font-medium text-text-dim transition group-hover:border-white/30 group-hover:text-text-muted">
          {index + 1}
        </span>
      )}
    </span>
  );
}

type SegmentVariant = "full" | "transition" | "pending";

function getSegmentVariant(
  index: number,
  activeIndex: number,
): SegmentVariant {
  if (index < activeIndex) return "full";
  if (index === activeIndex) return "transition";
  return "pending";
}

function SegmentLine({ variant }: { variant: SegmentVariant }) {
  const isTransition = variant === "transition";

  return (
    <div
      className={`relative mt-4 min-w-[12px] flex-1 self-start ${
        isTransition ? "h-[2px]" : "h-px"
      }`}
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

export function ProjectStepper({
  steps,
  activeStep,
  onStepChange,
}: ProjectStepperProps) {
  const activeIndex = steps.findIndex((step) => step.id === activeStep);

  return (
    <div className="w-full min-w-0 overflow-visible px-1 pt-2 pb-1">
      <div
        role="navigation"
        aria-label="Project workflow"
        className="overflow-x-auto overflow-y-visible py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-full min-w-[36rem] items-start">
          {steps.map((step, index) => {
            const state = getStepState(index, activeIndex);

            return (
              <Fragment key={step.id}>
                {index > 0 && (
                  <SegmentLine
                    variant={getSegmentVariant(index, activeIndex)}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onStepChange(step.id)}
                  aria-current={state === "active" ? "step" : undefined}
                  className="group flex min-w-0 flex-1 flex-col items-center outline-none"
                >
                  <StepCircle state={state} index={index} />
                  <span
                    className={`mt-2 max-w-[5.5rem] px-0.5 text-center text-[10px] leading-tight transition sm:max-w-none sm:text-[11px] ${
                      state === "active"
                        ? "font-medium text-white"
                        : state === "completed"
                          ? "text-accent/80"
                          : "text-text-dim group-hover:text-text-muted"
                    }`}
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
