import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { SessionPanel } from "./components/SessionPanel";
import { ChatArea } from "./components/ChatArea";
import { CreationView } from "./components/CreationView";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { LoginView } from "./components/LoginView";
import { I18nProvider, useTranslationMessages } from "./contexts/I18nContext";
import { useAppState } from "./hooks/useAppState";
import { readAuthSession, logout as clearAuthSession } from "./services/auth";
import type { AppNav, AuthUser } from "./types";

function MainApp({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const [activeNav, setActiveNav] = useState<AppNav>("creation");

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
      message === i18n.errors.modelsRequired
    ) {
      setSettingsOpen(true);
    }
  };

  return (
    <div className="flex h-screen min-h-0 bg-black">
      <Sidebar
        user={user}
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onOpenSettings={() => {
          setConfigError(null);
          setSettingsOpen(true);
        }}
        onLogout={() => {
          clearAuthSession();
          onLogout();
        }}
      />

      {activeNav === "session" ? (
        <div className="flex min-h-0 flex-1">
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

      <SettingsDrawer
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
