import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { SessionPanel } from "./components/SessionPanel";
import { ChatArea } from "./components/ChatArea";
import { CreationView } from "./components/CreationView";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { I18nProvider } from "./contexts/I18nContext";
import { useAppState } from "./hooks/useAppState";
import type { AppNav } from "./types";

function AppContent() {
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

  return (
    <div className="flex h-screen min-h-0 bg-black">
      <Sidebar
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onOpenSettings={() => {
          setConfigError(null);
          setSettingsOpen(true);
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
        <CreationView models={config.models} />
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

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
