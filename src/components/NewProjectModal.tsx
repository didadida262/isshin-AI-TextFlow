import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  loadArtSkills,
  loadDirectorManuals,
  type DirectorManualItem,
  type SkillManualItem,
} from "../services/skills";
import { projectToDraft } from "../services/projects";
import { SkillManualSection } from "./SkillManualSection";
import { Select } from "./Select";
import type { CreationProject } from "../types";

export interface NewProjectDraft {
  projectType: string;
  name: string;
  novelType: string;
  imageModel: string;
  imageQuality: string;
  videoModel: string;
  videoMode: string;
  aspectRatio: string;
  intro: string;
  artStyle: string;
  directorManual: string;
}

interface NewProjectModalProps {
  open: boolean;
  mode?: "create" | "edit";
  editingProject?: CreationProject | null;
  models: string[];
  onClose: () => void;
  onConfirm: (draft: NewProjectDraft) => void | Promise<void>;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3"];

function createDefaultDraft(
  models: string[],
  defaults: {
    novelType: string;
    intro: string;
    artStyle: string;
    directorManual: string;
  },
): NewProjectDraft {
  const firstModel = models[0] ?? "";
  return {
    projectType: "novel",
    name: "",
    novelType: defaults.novelType,
    imageModel: firstModel,
    imageQuality: "standard",
    videoModel: firstModel,
    videoMode: "standard",
    aspectRatio: "16:9",
    intro: defaults.intro,
    artStyle: defaults.artStyle,
    directorManual: defaults.directorManual,
  };
}

const fieldClass =
  "box-border h-10 w-full rounded-lg border border-white/10 bg-surface px-3 text-sm text-white outline-none transition focus:border-accent/50";

const textareaClass =
  "box-border w-full min-h-[7rem] resize-none rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent/50";

export function NewProjectModal({
  open,
  mode = "create",
  editingProject = null,
  models,
  onClose,
  onConfirm,
}: NewProjectModalProps) {
  const i18n = useTranslationMessages();
  const m = i18n.creation.modal;
  const [artSkills, setArtSkills] = useState<SkillManualItem[]>([]);
  const [directorManuals, setDirectorManuals] = useState<DirectorManualItem[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<NewProjectDraft>(() =>
    createDefaultDraft(models, {
      novelType: m.defaultNovelType,
      intro: m.defaultIntro,
      artStyle: "",
      directorManual: "",
    }),
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setSkillsLoading(true);

    void Promise.all([loadArtSkills(), loadDirectorManuals()]).then(
      ([art, manuals]) => {
        if (cancelled) return;

        setArtSkills(art);
        setDirectorManuals(manuals);
        setSkillsLoading(false);

        if (mode === "edit" && editingProject) {
          setDraft(projectToDraft(editingProject));
        } else {
          setDraft(
            createDefaultDraft(models, {
              novelType: m.defaultNovelType,
              intro: m.defaultIntro,
              artStyle: art[0]?.id ?? "",
              directorManual: manuals[0]?.id ?? "",
            }),
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    open,
    mode,
    editingProject,
    models,
    m.defaultNovelType,
    m.defaultIntro,
  ]);

  const aspectRatioOptions = ASPECT_RATIOS.map((ratio) => ({
    value: ratio,
    label: ratio,
  }));

  const directorManualOptions = directorManuals.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const handleConfirm = async () => {
    if (submitting) return;
    const name = draft.name.trim() || m.defaultProjectName;
    setSubmitting(true);
    try {
      await onConfirm({ ...draft, name });
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = mode === "edit" ? m.editTitle : m.title;
  const confirmLabel = submitting
    ? mode === "edit"
      ? m.saving
      : m.creating
    : m.confirm;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal
              aria-labelledby="new-project-title"
              className="flex max-h-[min(820px,calc(100vh-3rem))] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-4">
                <h2
                  id="new-project-title"
                  className="text-lg font-semibold text-white"
                >
                  {modalTitle}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <div className="space-y-4">
                    <label className="block space-y-2">
                      <span className="text-sm text-text-muted">
                        {m.projectName}
                      </span>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, name: e.target.value }))
                        }
                        placeholder={m.defaultProjectName}
                        className={fieldClass}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm text-text-muted">
                        {m.novelType}
                      </span>
                      <input
                        type="text"
                        value={draft.novelType}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, novelType: e.target.value }))
                        }
                        placeholder={m.novelTypePlaceholder}
                        className={fieldClass}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm text-text-muted">
                        {m.aspectRatio}
                      </span>
                      <Select
                        value={draft.aspectRatio}
                        options={aspectRatioOptions}
                        onChange={(aspectRatio) =>
                          setDraft((d) => ({ ...d, aspectRatio }))
                        }
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm text-text-muted">
                        {m.directorManual}
                      </span>
                      <Select
                        value={draft.directorManual}
                        options={directorManualOptions}
                        onChange={(directorManual) =>
                          setDraft((d) => ({ ...d, directorManual }))
                        }
                        disabled={skillsLoading || directorManualOptions.length === 0}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm text-text-muted">{m.intro}</span>
                      <textarea
                        rows={4}
                        value={draft.intro}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, intro: e.target.value }))
                        }
                        placeholder={m.introPlaceholder}
                        className={textareaClass}
                      />
                    </label>
                  </div>
                </div>

                <aside className="flex min-h-0 w-[420px] shrink-0 flex-col gap-5 border-l border-white/5 bg-[#0f0f0f] p-5">
                  <SkillManualSection
                    title={m.visualManual}
                    items={artSkills}
                    loading={skillsLoading}
                    selectedId={draft.artStyle}
                    onSelect={(artStyle) =>
                      setDraft((d) => ({ ...d, artStyle }))
                    }
                    variant="visual"
                  />
                </aside>
              </div>

              <footer className="flex shrink-0 justify-end gap-3 border-t border-white/5 px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/10 bg-surface px-5 py-2 text-sm text-text-muted transition hover:border-white/20 hover:text-white"
                >
                  {m.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {confirmLabel}
                </button>
              </footer>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
