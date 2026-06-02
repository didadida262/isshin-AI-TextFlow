import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudArrowUp, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import { ModalPortal } from "./ModalPortal";

interface ImportNovelModalProps {
  open: boolean;
  initialContent?: string;
  onClose: () => void;
  onConfirm: (content: string) => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".txt", ".docx"];

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function ImportNovelModal({
  open,
  initialContent = "",
  onClose,
  onConfirm,
}: ImportNovelModalProps) {
  const m = useTranslationMessages().creation.importNovelModal;
  const [content, setContent] = useState(initialContent);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setContent(initialContent);
    setFileError("");
  }, [open, initialContent]);

  const canSave = content.trim().length > 0;

  const readTextFile = useCallback(
    async (file: File) => {
      setFileError("");

      if (!isAcceptedFile(file)) {
        setFileError(m.unsupportedFormat);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError(m.fileTooLarge);
        return;
      }

      if (file.name.toLowerCase().endsWith(".docx")) {
        setFileError(m.docxComingSoon);
        return;
      }

      try {
        const text = await file.text();
        setContent(text);
      } catch {
        setFileError(m.readFailed);
      }
    },
    [m],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) void readTextFile(file);
    },
    [readTextFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleSave = () => {
    if (!canSave) return;
    onConfirm(content.trim());
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && (
        <motion.div
          key="import-novel-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayExit}
        >
          <button
            type="button"
            aria-label={m.title}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal
            className="relative z-10 flex max-h-[min(580px,calc(100dvh-7rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-3.5">
              <h2 className="text-base font-semibold text-white">{m.title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-white"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-3.5 text-center transition ${
                    dragOver
                      ? "border-accent/60 bg-accent/5"
                      : "border-white/15 bg-surface/30 hover:border-white/25 hover:bg-surface/50"
                  }`}
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <FontAwesomeIcon icon={faCloudArrowUp} className="text-base" />
                  </div>
                  <p className="text-sm text-white">{m.uploadHint}</p>
                  <p className="mt-1 text-xs text-text-muted">{m.uploadFormats}</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.docx"
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>

                {fileError ? (
                  <p className="shrink-0 text-xs text-red-400">{fileError}</p>
                ) : null}

                <div className="relative flex shrink-0 items-center">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="whitespace-nowrap px-3 text-xs text-text-muted">
                    {m.or} {m.pasteLabel}
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <label className="flex min-h-0 flex-1 flex-col">
                  <textarea
                    value={content}
                    onChange={(e) => {
                      setFileError("");
                      setContent(e.target.value);
                    }}
                    placeholder={m.pastePlaceholder}
                    className="box-border min-h-[220px] flex-1 w-full resize-none overflow-y-auto rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent/50"
                  />
                  <p className="mt-2 shrink-0 text-right text-xs text-text-muted">
                    {content.length} {m.charsUnit}
                  </p>
                </label>
            </div>

            <footer className="flex shrink-0 justify-end border-t border-white/5 px-5 py-3.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {m.save}
              </button>
            </footer>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
