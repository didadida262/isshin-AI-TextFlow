import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./components/Sidebar";
import { SessionPanel } from "./components/SessionPanel";
import { ChatArea } from "./components/ChatArea";
import { CreationView } from "./components/CreationView";
import { SettingsModal } from "./components/settings/SettingsModal";
import { LoginView } from "./components/LoginView";
import { I18nProvider, useTranslationMessages } from "./contexts/I18nContext";
import { useAppState } from "./hooks/useAppState";
import { readAuthSession, logout as clearAuthSession } from "./services/auth";
import type { AppNav, AuthUser } from "./types";

const NAV_ORDER: AppNav[] = ["creation", "session"];

const navTransition = {
  type: "tween" as const,
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

const navPanelVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction > 0 ? 28 : -28,
    filter: "blur(4px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction > 0 ? -28 : 28,
    filter: "blur(4px)",
  }),
};

function MainApp({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const [activeNav, setActiveNav] = useState<AppNav>("creation");
  const [navDirection, setNavDirection] = useState(0);
  const [enableNavAnimation, setEnableNavAnimation] = useState(false);

  const handleNavChange = useCallback((nav: AppNav) => {
    if (nav === activeNav) return;

    const prevIndex = NAV_ORDER.indexOf(activeNav);
    const nextIndex = NAV_ORDER.indexOf(nav);
    setNavDirection(nextIndex >= prevIndex ? 1 : -1);
    setEnableNavAnimation(true);
    setActiveNav(nav);
  }, [activeNav]);

  const {
    config,
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    selectedModel,
    setSelectedModel,
    settingsOpen,
    setSettingsOpen,
    isLoading,
    configError,
    setConfigError,
    handleSaveConfig,
    sendMessage,
    stopGeneration,
    newSession,
    deleteSession,
    chatMode,
    setChatMode,
  } = useAppState();
  const i18n = useTranslationMessages();

  const handleCreationConfigError = (message: string | null) => {
    setConfigError(message);
    if (
      message === i18n.errors.configRequired ||
      message === i18n.errors.modelsRequired ||
      message === i18n.errors.imageConfigRequired
    ) {
      setSettingsOpen(true);
    }
  };

  return (
    <div className="flex h-screen min-h-0 bg-black">
      <Sidebar
        user={user}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        onOpenSettings={() => {
          setConfigError(null);
          setSettingsOpen(true);
        }}
        onLogout={() => {
          clearAuthSession();
          onLogout();
        }}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={activeNav}
            custom={navDirection}
            variants={navPanelVariants}
            initial={enableNavAnimation ? "enter" : false}
            animate="center"
            exit="exit"
            transition={navTransition}
            className="flex min-h-0 min-w-0 flex-1 will-change-[transform,opacity,filter]"
          >
            {activeNav === "session" ? (
              <div className="flex min-h-0 min-w-0 flex-1">
                <SessionPanel
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelectSession={setActiveSessionId}
                  onNewSession={newSession}
                  onDeleteSession={deleteSession}
                />
                <ChatArea
                  messages={activeSession.messages}
                  activeSessionId={activeSessionId}
                  models={config.models}
                  selectedModel={selectedModel}
                  onSelectModel={setSelectedModel}
                  onSend={sendMessage}
                  isLoading={isLoading}
                  onStop={stopGeneration}
                  configError={configError}
                  chatMode={chatMode}
                  onChatModeChange={setChatMode}
                />
              </div>
            ) : (
              <CreationView
                config={config}
                selectedModel={selectedModel}
                onConfigError={handleCreationConfigError}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <SettingsModal
        open={settingsOpen}
        config={config}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveConfig}
      />
    </div>
  );
}

function AppContent() {
  const [user, setUser] = useState<AuthUser | null>(() => readAuthSession());

  if (!user) {
    return <LoginView onSuccess={setUser} />;
  }

  return <MainApp user={user} onLogout={() => setUser(null)} />;
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
