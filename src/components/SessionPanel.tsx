import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { ChatSession } from "../types";

interface SessionPanelProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
}

export function SessionPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: SessionPanelProps) {
  const messages = useTranslationMessages();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-white/5 bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs text-text-muted uppercase tracking-wider">
          {messages.session.history}
        </span>
        <button
          type="button"
          onClick={onNewSession}
          className="rounded-md p-1.5 text-text-muted transition hover:bg-white/5 hover:text-white"
          title={messages.session.newSession}
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group flex items-center gap-0.5 rounded-lg transition ${
              s.id === activeSessionId
                ? "bg-surface-elevated"
                : "hover:bg-white/5"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectSession(s.id)}
              className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm transition ${
                s.id === activeSessionId
                  ? "text-white"
                  : "text-text-muted group-hover:text-white"
              }`}
            >
              {s.title}
            </button>
            <button
              type="button"
              onClick={() => onDeleteSession(s.id)}
              title={messages.session.deleteSession}
              className={`mr-1 shrink-0 rounded p-1.5 text-text-dim transition hover:bg-red-500/10 hover:text-red-400 ${
                s.id === activeSessionId
                  ? "opacity-70"
                  : "opacity-0 group-hover:opacity-70"
              }`}
            >
              <FontAwesomeIcon icon={faTrash} className="text-xs" />
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
