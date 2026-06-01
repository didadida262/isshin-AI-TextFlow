import type { TranslationSchema } from "./zh";

export const en: TranslationSchema = {
  nav: {
    session: "Chat",
    creation: "Create",
    settings: "Settings",
  },
  language: {
    label: "Language",
    switchToEn: "Switch to English",
    switchToZh: "Switch to Chinese",
    zh: "中文",
    en: "EN",
  },
  session: {
    history: "History",
    newSession: "New chat",
    deleteSession: "Delete session",
  },
  chat: {
    title: "Chat",
    greeting: "How can I help you today?",
    emptyAgent:
      'Agent mode: try "read project" or "view files" to read local package.json and other project files',
    emptyChat:
      "Chat mode: talk directly to the model; switch to Agent to read local project files",
  },
  mode: {
    chat: "Chat",
    agent: "Agent",
    ariaLabel: "Chat mode",
  },
  input: {
    placeholderChat: "Type a message… Shift+Enter for newline, Enter to send",
    placeholderAgent:
      'Agent mode: try "read project", "view files", etc.',
    send: "Send",
    stop: "Stop generating",
  },
  model: {
    label: "Model",
    none: "Not selected",
    empty:
      "No models yet. Open Settings, enter your API Key, and sync the model list",
  },
  settings: {
    title: "Model Settings",
    baseUrl: "API Base URL",
    apiKey: "API Key",
    models: "Available models",
    refresh: "Refresh list",
    refreshing: "Loading…",
    syncHint: "Auto-sync via platform API:",
    modelsLoaded: "{{count}} models loaded",
    fetchingModels: "Fetching model list…",
    removeModel: "Remove from list",
    apiKeyHint: "Models will load automatically after you enter an API Key",
    testConnection: "Test connection",
    testing: "Testing…",
    selectModelFirst: "Please select a model first",
    connectionOk: "Connection successful",
  },
  errors: {
    configRequired: "Please configure Base URL and API Key in Settings first",
    modelsRequired: "Please sync the model list in Settings first",
    requestFailed: "Request failed: {{error}}",
  },
  agent: {
    analyzing: "Analyzing intent…",
    recognizing: "Recognizing intent…",
    reading: "Reading {{file}}…",
    projectFile: "project file",
    organizing: "Organizing observations…",
    done: "Agent completed",
    idle: "Idle",
    contextPrefix:
      "The following is real file content read by the local Agent. Answer the user based on it:\n",
  },
};
