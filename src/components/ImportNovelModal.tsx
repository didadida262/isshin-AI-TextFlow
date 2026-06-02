import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudArrowUp, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";

interface ImportNovelModalProps {
  open: boolean;
  initialContent?: string;
  onClose: () => void;
  onConfirm: (content: string) => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
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
              className="flex max-h-[min(720px,calc(100vh-3rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">{m.title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-5">
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
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition ${
                      dragOver
                        ? "border-accent/60 bg-accent/5"
                        : "border-white/15 bg-surface/30 hover:border-white/25 hover:bg-surface/50"
                    }`}
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <FontAwesomeIcon
                        icon={faCloudArrowUp}
                        className="text-xl"
                      />
                    </div>
                    <p className="text-sm text-white">{m.uploadHint}</p>
                    <p className="mt-2 text-xs text-text-muted">
                      {m.uploadFormats}
                    </p>
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
                    <p className="text-xs text-red-400">{fileError}</p>
                  ) : null}

                  <div className="relative flex items-center py-1">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="px-3 text-xs text-text-dim">{m.or}</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm text-text-muted">
                      {m.pasteLabel}
                    </span>
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setFileError("");
                        setContent(e.target.value);
                      }}
                      placeholder={m.pastePlaceholder}
                      className="box-border min-h-[180px] w-full resize-y rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent/50"
                    />
                  </label>

                  <p className="text-xs text-text-muted">
                    {content.length} {m.charsUnit}
                  </p>
                </div>
              </div>

              <footer className="flex shrink-0 justify-end border-t border-white/5 px-6 py-4">
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
        </>
      )}
    </AnimatePresence>
  );
}
