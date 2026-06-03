import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClapperboard,
  faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import type { CreationProject } from "../types";

interface ProjectCardProps {
  project: CreationProject;
  editLabel: string;
  onOpen: () => void;
  onEdit: () => void;
  formatDate: (timestamp: number) => string;
}

export function ProjectCard({
  project,
  editLabel,
  onOpen,
  onEdit,
  formatDate,
}: ProjectCardProps) {
  return (
    <li className="group list-none">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400/35 via-accent/25 to-emerald-500/10 p-px shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition duration-300 group-hover:-translate-y-1 group-hover:from-cyan-400/50 group-hover:via-accent/40 group-hover:shadow-[0_12px_36px_rgba(0,255,102,0.14)]">
        <button
          type="button"
          onClick={onOpen}
          className="relative flex min-h-[172px] w-full flex-col overflow-hidden rounded-[calc(1rem-1px)] bg-[#0c0c0c] p-5 text-left transition hover:bg-[#0e0e0e]"
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-[calc(1rem-1px)] bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-accent/[0.06]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-accent/10 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-cyan-400/10 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
            aria-hidden
          />

          <div className="relative flex items-start gap-3.5 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <FontAwesomeIcon icon={faClapperboard} className="text-sm" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold tracking-tight text-white transition group-hover:text-accent">
                {project.name}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-muted">
                {project.intro || project.novelType}
              </p>
            </div>
          </div>

          <div className="relative mt-auto flex items-center justify-between gap-3 pt-4">
            <div className="flex min-w-0 flex-wrap gap-2">
              <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200/90">
                {project.aspectRatio}
              </span>
              {project.novelType ? (
                <span className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-medium text-accent/90">
                  {project.novelType}
                </span>
              ) : null}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-text-dim">
              {formatDate(project.createdAt)}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          title={editLabel}
          aria-label={editLabel}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-text-muted opacity-0 backdrop-blur-sm transition hover:border-accent/40 hover:bg-accent/10 hover:text-accent focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 pointer-events-none"
        >
          <FontAwesomeIcon icon={faPenToSquare} className="text-[10px]" />
        </button>
      </div>
    </li>
  );
}
