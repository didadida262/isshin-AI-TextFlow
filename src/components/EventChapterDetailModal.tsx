import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { NovelChapterRecord } from "../services/novel";
import { ModalPortal } from "./ModalPortal";

interface EventChapterDetailModalProps {
  chapter: NovelChapterRecord | null;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0">
      <dt className="mb-1.5 text-xs font-medium text-text-muted">{label}</dt>
      <dd className="text-sm leading-relaxed text-white">{children}</dd>
    </div>
  );
}

export function EventChapterDetailModal({
  chapter,
  onClose,
}: EventChapterDetailModalProps) {
  const i18n = useTranslationMessages();
  const s = i18n.creation.extractEventsStep;

  return (
    <ModalPortal>
      <AnimatePresence>
        {chapter ? (
          <motion.div
            key={`chapter-detail-${chapter.id}`}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={i18n.creation.cancel}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="event-chapter-detail-title"
              className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-surface shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                <h3
                  id="event-chapter-detail-title"
                  className="min-w-0 text-base font-semibold text-white"
                >
                  {s.chapterDetailTitle(chapter.chapterIndex, chapter.chapter)}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/10 hover:text-white"
                  aria-label={i18n.creation.cancel}
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <dl className="space-y-5">
                  <DetailField label={s.colIndex}>
                    {chapter.chapterIndex}
                  </DetailField>
                  <DetailField label={s.colReel}>{chapter.reel}</DetailField>
                  <DetailField label={s.colChapter}>{chapter.chapter}</DetailField>
                  {chapter.errorReason ? (
                    <DetailField label={s.colErrorReason}>
                      <p className="whitespace-pre-wrap break-words text-red-400">
                        {chapter.errorReason}
                      </p>
                    </DetailField>
                  ) : (
                    <DetailField label={s.colEvent}>
                      <p className="whitespace-pre-wrap break-words">
                        {chapter.event || s.noEvent}
                      </p>
                    </DetailField>
                  )}
                  <DetailField label={s.colContent}>
                    <p className="whitespace-pre-wrap break-words text-text-muted">
                      {chapter.chapterData}
                    </p>
                  </DetailField>
                </dl>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
