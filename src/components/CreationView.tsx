import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClapperboard,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  createProject,
  deleteProject,
  draftToProjectInput,
  loadProjects,
  updateProject,
} from "../services/projects";
import {
  NewProjectModal,
  type NewProjectDraft,
} from "./NewProjectModal";
import { DeleteProjectConfirmModal } from "./DeleteProjectConfirmModal";
import { ProjectCard } from "./ProjectCard";
import { ProjectDetailView } from "./ProjectDetailView";
import type { AppConfig, CreationProject } from "../types";

interface CreationViewProps {
  config: AppConfig;
  selectedModel: string;
  onConfigError: (message: string | null) => void;
  onProjectDetailChange?: (inDetail: boolean) => void;
}

function formatProjectDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function CreationView({
  config,
  selectedModel,
  onConfigError,
  onProjectDetailChange,
}: CreationViewProps) {
  const i18n = useTranslationMessages();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProject, setEditingProject] = useState<CreationProject | null>(
    null,
  );
  const [projects, setProjects] = useState<CreationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<CreationProject | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

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

  const openDeleteModal = (project: CreationProject) => {
    setDeletingProject(project);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeletingProject(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;

    setIsDeleting(true);
    onConfigError(null);
    const result = await deleteProject(deletingProject.id);
    setIsDeleting(false);

    if (!result.ok) {
      onConfigError(result.message);
      return;
    }

    if (activeProjectId === deletingProject.id) {
      setActiveProjectId(null);
      onProjectDetailChange?.(false);
    }

    setDeletingProject(null);
    await refreshProjects();
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
    onProjectDetailChange?.(true);
  };

  const backToList = () => {
    setActiveProjectId(null);
    onProjectDetailChange?.(false);
  };

  if (activeProject) {
    return (
      <ProjectDetailView
        project={activeProject}
        config={config}
        selectedModel={selectedModel}
        onConfigError={onConfigError}
        onBack={backToList}
      />
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
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  openMenuLabel={i18n.creation.openProjectMenu}
                  editLabel={i18n.creation.editProject}
                  deleteLabel={i18n.creation.deleteProject}
                  formatDate={formatProjectDate}
                  onOpen={() => openProject(project)}
                  onEdit={() => openEditModal(project)}
                  onDelete={() => openDeleteModal(project)}
                />
              ))}
            </ul>
          )}
        </div>
      </main>

      <NewProjectModal
        open={modalOpen}
        mode={modalMode}
        editingProject={editingProject}
        models={config.models}
        onClose={closeModal}
        onConfirm={handleConfirm}
      />

      <DeleteProjectConfirmModal
        project={deletingProject}
        deleting={isDeleting}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
