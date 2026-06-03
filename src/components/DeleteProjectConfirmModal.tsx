import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { CreationProject } from "../types";
import { ModalPortal } from "./ModalPortal";

interface DeleteProjectConfirmModalProps {
  project: CreationProject | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

export function DeleteProjectConfirmModal({
  project,
  deleting,
  onClose,
  onConfirm,
}: DeleteProjectConfirmModalProps) {
  const s = useTranslationMessages().creation;

  return (
    <ModalPortal>
      <AnimatePresence>
        {project ? (
          <motion.div
            key="delete-project-modal"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={s.cancel}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={deleting ? undefined : onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-project-title"
              className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-surface shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h3
                  id="delete-project-title"
                  className="text-base font-semibold text-white"
                >
                  {s.deleteConfirmTitle}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={deleting}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              <div className="px-5 py-4">
                <p className="text-sm leading-relaxed text-text-muted">
                  {s.deleteConfirm(project.name)}
                </p>
                <p className="mt-2 text-xs text-text-dim">{s.deleteConfirmHint}</p>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={deleting}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  {s.cancel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                      {s.deleting}
                    </>
                  ) : (
                    s.deleteProject
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
