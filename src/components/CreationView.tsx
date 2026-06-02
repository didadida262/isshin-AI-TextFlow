import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClapperboard,
  faPenToSquare,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  createProject,
  draftToProjectInput,
  loadProjects,
  updateProject,
} from "../services/projects";
import {
  NewProjectModal,
  type NewProjectDraft,
} from "./NewProjectModal";
import { ProjectDetailView } from "./ProjectDetailView";
import type { CreationProject } from "../types";

interface CreationViewProps {
  models: string[];
}

function formatProjectDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function CreationView({ models }: CreationViewProps) {
  const i18n = useTranslationMessages();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProject, setEditingProject] = useState<CreationProject | null>(
    null,
  );
  const [projects, setProjects] = useState<CreationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    const items = await loadProjects();
    setProjects(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? null;

  const openCreateModal = () => {
    setModalMode("create");
    setEditingProject(null);
    setModalOpen(true);
  };

  const openEditModal = (project: CreationProject) => {
    setModalMode("edit");
    setEditingProject(project);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProject(null);
  };

  const handleConfirm = async (draft: NewProjectDraft) => {
    if (modalMode === "edit" && editingProject) {
      const updated = await updateProject(editingProject.id, draft);
      if (!updated) return;
    } else {
      const created = await createProject(draftToProjectInput(draft));
      if (!created) return;
    }

    await refreshProjects();
    closeModal();
  };

  const openProject = (project: CreationProject) => {
    setActiveProjectId(project.id);
  };

  const backToList = () => {
    setActiveProjectId(null);
  };

  if (activeProject) {
    return (
      <ProjectDetailView project={activeProject} onBack={backToList} />
    );
  }

  return (
    <>
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black p-6">
        <header className="flex shrink-0 items-center justify-between gap-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {i18n.creation.title}
          </h1>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black transition hover:scale-[1.02] hover:bg-accent/90 active:scale-[0.98]"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            {i18n.creation.newProject}
          </button>
        </header>

        <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-white/10 bg-surface/30 p-6">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
              …
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-surface">
                <FontAwesomeIcon
                  icon={faClapperboard}
                  className="text-xl text-text-muted"
                />
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-text-muted">
                {i18n.creation.empty}
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li key={project.id} className="relative">
                  <button
                    type="button"
                    onClick={() => openProject(project)}
                    className="flex h-full w-full flex-col rounded-xl border border-white/10 bg-surface p-4 pr-10 text-left transition hover:border-accent/40 hover:bg-surface-elevated"
                  >
                    <h3 className="truncate font-medium text-white">
                      {project.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">
                      {project.intro || project.novelType}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-dim">
                      <span className="rounded-md border border-white/10 px-2 py-0.5">
                        {project.aspectRatio}
                      </span>
                      {project.novelType ? (
                        <span className="rounded-md border border-white/10 px-2 py-0.5">
                          {project.novelType}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-[11px] text-text-dim">
                      {formatProjectDate(project.createdAt)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(project)}
                    title={i18n.creation.editProject}
                    aria-label={i18n.creation.editProject}
                    className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition hover:bg-white/5 hover:text-accent"
                  >
                    <FontAwesomeIcon icon={faPenToSquare} className="text-[10px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <NewProjectModal
        open={modalOpen}
        mode={modalMode}
        editingProject={editingProject}
        models={models}
        onClose={closeModal}
        onConfirm={handleConfirm}
      />
    </>
  );
}
