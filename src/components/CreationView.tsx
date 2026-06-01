import { useState } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClapperboard, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  draftToProject,
  NewProjectModal,
  type NewProjectDraft,
} from "./NewProjectModal";
import type { CreationProject } from "../types";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

interface CreationViewProps {
  models: string[];
}

export function CreationView({ models }: CreationViewProps) {
  const i18n = useTranslationMessages();
  const [modalOpen, setModalOpen] = useState(false);
  const [projects, setProjects] = useState<CreationProject[]>([]);

  const handleConfirm = (draft: NewProjectDraft) => {
    setProjects((prev) => [draftToProject(draft), ...prev]);
  };

  return (
    <>
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black p-6">
        <header className="flex shrink-0 items-center justify-between gap-6">
          <motion.h1
            className="text-2xl font-semibold tracking-tight text-white"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
          >
            {i18n.creation.title}
          </motion.h1>

          <motion.button
            type="button"
            onClick={() => setModalOpen(true)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black transition hover:bg-accent/90"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            {i18n.creation.newProject}
          </motion.button>
        </header>

        <motion.div
          className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-dashed border-white/10 bg-surface/30 p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.08 }}
        >
          {projects.length === 0 ? (
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
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-xl border border-white/10 bg-surface p-4 transition hover:border-white/20"
                >
                  <h3 className="truncate font-medium text-white">
                    {project.name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-text-muted">
                    {project.novelType || project.aspectRatio}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </main>

      <NewProjectModal
        open={modalOpen}
        models={models}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
