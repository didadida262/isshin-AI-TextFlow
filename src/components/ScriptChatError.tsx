import type { ScriptChatMessage } from "../agents/workflowAgent/scriptGeneration";
import ChatGptLogo from "../assets/ChatGptLogo";
import { MarkdownContent } from "./MarkdownContent";

export function ScriptChatError({ message }: { message: ScriptChatMessage }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#10A37F] text-white">
        <ChatGptLogo className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        {message.name ? (
          <p className="mb-1 text-[11px] font-medium text-text-muted">
            {message.name}
          </p>
        ) : null}
        <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-sm leading-relaxed text-white/90 shadow-[0_0_12px_rgba(239,68,68,0.08)]">
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
