import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDatabase,
  faMicrochip,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { AppConfig } from "../../types";
import { useTranslationMessages } from "../../contexts/I18nContext";
import { loadConfig, saveConfig } from "../../services/config";
import { fetchAvailableModels } from "../../services/models";
import { ModalPortal } from "../ModalPortal";
import { DatabaseOperationsPanel } from "./DatabaseOperationsPanel";
import { ModelServiceSettingsPanel } from "./ModelServiceSettingsPanel";

const DEFAULT_BASE_URL = "https://aiplatform.njsrd.com/llm/v1";
const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

type SettingsTab = "modelService" | "database";

interface SettingsModalProps {
  open: boolean;
  config: AppConfig;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onClose: () => void;
  onSave: (config: AppConfig) => void;
  onDatabaseChanged?: () => void;
}

const TABS: Array<{
  id: SettingsTab;
  icon: typeof faMicrochip;
}> = [
  { id: "modelService", icon: faMicrochip },
  { id: "database", icon: faDatabase },
];

export function SettingsModal({
  open,
  config,
  selectedModel,
  onSelectModel,
  onClose,
  onSave,
  onDatabaseChanged,
}: SettingsModalProps) {
  const i18n = useTranslationMessages();
  const [activeTab, setActiveTab] = useState<SettingsTab>("modelService");
  const [draft, setDraft] = useState<AppConfig>(config);
  const [modelsStatus, setModelsStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [modelsError, setModelsError] = useState("");
  const hydratedRef = useRef(false);

  const syncModels = useCallback(async (apiKey: string) => {
    setModelsStatus("loading");
    setModelsError("");
    try {
      const models = await fetchAvailableModels(apiKey);
      setDraft((current) => ({ ...current, models }));
      setModelsStatus("ok");
    } catch (error) {
      setModelsStatus("error");
      setModelsError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    if (!open) {
      hydratedRef.current = false;
      return;
    }

    let cancelled = false;
    void loadConfig().then((cfg) => {
      if (cancelled) return;
      setDraft({
        ...cfg,
        baseUrl: cfg.baseUrl.trim() || DEFAULT_BASE_URL,
      });
      setModelsStatus("idle");
      setModelsError("");
      setActiveTab("modelService");
      hydratedRef.current = true;
      if (cfg.apiKey.trim()) {
        void syncModels(cfg.apiKey);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, syncModels]);

  useEffect(() => {
    if (!open || !hydratedRef.current) return;

    const timer = window.setTimeout(() => {
      void saveConfig(draft);
      onSave(draft);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [draft, open, onSave]);

  const handleClose = () => {
    void saveConfig(draft);
    onSave(draft);
    onClose();
  };

  const tabLabel = (tab: SettingsTab) =>
    tab === "modelService" ? i18n.settings.tabModelService : i18n.settings.tabDatabase;

  return (
    <ModalPortal>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="settings-modal"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={i18n.settings.title}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={handleClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-modal-title"
              className="relative z-10 flex h-[min(820px,calc(100dvh-3rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl"
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={spring}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 id="settings-modal-title" className="text-lg font-semibold text-white">
                  {i18n.settings.title}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <nav className="flex w-52 shrink-0 flex-col gap-1 self-stretch border-r border-white/10 bg-black/20 p-3">
                  {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          isActive
                            ? "bg-accent/10 font-medium text-accent"
                            : "text-text-muted hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <FontAwesomeIcon icon={tab.icon} className="text-xs" />
                        {tabLabel(tab.id)}
                      </button>
                    );
                  })}
                </nav>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  {activeTab === "modelService" ? (
                    <ModelServiceSettingsPanel
                      draft={draft}
                      selectedModel={selectedModel}
                      onDraftChange={(updater) => setDraft(updater)}
                      onSelectModel={onSelectModel}
                      onSyncModels={syncModels}
                      modelsStatus={modelsStatus}
                      modelsError={modelsError}
                    />
                  ) : (
                    <DatabaseOperationsPanel
                      onDatabaseChanged={onDatabaseChanged}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
