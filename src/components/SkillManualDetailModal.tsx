import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  loadArtSkillDetail,
  loadStorySkillDetail,
  type SkillDetail,
} from "../services/skills";
import { MarkdownContent } from "./MarkdownContent";

interface SkillManualDetailModalProps {
  open: boolean;
  skillId: string | null;
  variant: "visual" | "director";
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const fieldClass =
  "box-border flex h-10 w-full items-center rounded-lg border border-white/10 bg-surface px-3 text-sm text-white/80";

export function SkillManualDetailModal({
  open,
  skillId,
  variant,
  onClose,
}: SkillManualDetailModalProps) {
  const i18n = useTranslationMessages();
  const t = i18n.creation.skillDetail;
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("README");

  useEffect(() => {
    if (!open || !skillId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setActiveTab("README");

    const load =
      variant === "visual"
        ? loadArtSkillDetail(skillId)
        : loadStorySkillDetail(skillId);

    void load.then((data) => {
      if (cancelled) return;
      setDetail(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, skillId, variant]);

  const title =
    variant === "visual" ? t.viewVisualManual : t.viewDirectorManual;
  const nameLabel = variant === "visual" ? t.visualName : t.directorName;
  const fileLabel = variant === "visual" ? t.visualFile : t.directorFile;
  const coverLabel = variant === "visual" ? t.visualCover : t.directorCover;
  const tabsLabel = variant === "visual" ? t.visualPromptTabs : t.directorPromptTabs;

  const activeContent =
    detail?.tabs.find((tab) => tab.value === activeTab)?.content ?? "";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal
              className="flex max-h-[min(820px,calc(100vh-3rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {loading ? (
                  <div className="flex h-48 items-center justify-center text-sm text-text-dim">
                    {t.loading}
                  </div>
                ) : detail ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <label className="block space-y-2">
                        <span className="text-sm text-text-muted">
                          {nameLabel}
                        </span>
                        <div className={fieldClass}>{detail.name}</div>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm text-text-muted">
                          {fileLabel}
                        </span>
                        <div className={fieldClass}>{detail.id}</div>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <span className="text-sm text-text-muted">
                        {coverLabel}
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {detail.imageUrls.length > 0 ? (
                          detail.imageUrls.map((url) => (
                            <div
                              key={url}
                              className="h-24 w-24 overflow-hidden rounded-lg border border-white/10 bg-surface"
                            >
                              <img
                                src={url}
                                alt={detail.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-white/10 bg-surface text-xs text-text-dim">
                            —
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-sm text-text-muted">
                        {tabsLabel}
                      </span>
                      <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-px">
                        {detail.tabs.map((tab) => {
                          const active = tab.value === activeTab;
                          return (
                            <button
                              key={tab.value}
                              type="button"
                              onClick={() => setActiveTab(tab.value)}
                              className={`shrink-0 border-b-2 px-3 py-2 text-xs transition ${
                                active
                                  ? "border-accent text-accent"
                                  : "border-transparent text-text-muted hover:text-white"
                              }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="min-h-[280px] rounded-lg border border-white/10 bg-[#0f0f0f] p-4 text-sm text-text-muted">
                        {activeContent.trim() ? (
                          <MarkdownContent content={activeContent} />
                        ) : (
                          <p className="text-text-dim">{t.emptyContent}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center text-sm text-text-dim">
                    {t.emptyContent}
                  </div>
                )}
              </div>

              <footer className="flex shrink-0 justify-end border-t border-white/5 px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/10 bg-surface px-5 py-2 text-sm text-text-muted transition hover:border-white/20 hover:text-white"
                >
                  {t.close}
                </button>
              </footer>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
