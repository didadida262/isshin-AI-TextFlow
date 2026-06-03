import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBrain,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import type { ChatMessage } from "../types";
import ChatGptLogo from "../assets/ChatGptLogo";
import { MarkdownContent } from "./MarkdownContent";

interface MessageBubbleProps {
  message: ChatMessage;
}

const bubbleSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "tool-status") {
    return (
      <motion.div
        className="flex justify-start"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={bubbleSpring}
      >
        <motion.div
          className="flex max-w-lg items-start gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm"
          animate={
            message.toolPhase !== "done"
              ? { borderColor: ["rgba(0,255,102,0.2)", "rgba(0,255,102,0.5)", "rgba(0,255,102,0.2)"] }
              : {}
          }
          transition={{ repeat: message.toolPhase !== "done" ? Infinity : 0, duration: 1.5 }}
        >
          <FontAwesomeIcon
            icon={message.toolPhase === "done" ? faBrain : faSpinner}
            spin={message.toolPhase !== "done"}
            className="mt-0.5 text-accent"
          />
          <motion.div>
            <p className="text-accent text-xs font-medium uppercase tracking-wider">
              Tool · {message.toolPhase ?? "thought"}
            </p>
            <p className="mt-1 text-text-muted">{message.content}</p>
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  const isUser = message.role === "user";
  const displayContent = message.content.trimStart();

  if (!displayContent && !message.isStreaming) {
    return null;
  }

  return (
    <motion.div
      className={`flex w-full min-w-0 items-start ${isUser ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={bubbleSpring}
    >
      {!isUser && (
        <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#10A37F] text-white">
          <ChatGptLogo className="h-5 w-5" />
        </div>
      )}
      <motion.div
        className={`min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "max-w-[75%] whitespace-pre-wrap bg-surface-elevated text-white"
            : "max-w-[min(85%,48rem)] overflow-hidden border border-white/10 bg-surface text-white/90"
        }`}
      >
        {isUser ? (
          displayContent
        ) : (
          <MarkdownContent content={displayContent} />
        )}
        {message.isStreaming && (
          <motion.span
            className="ml-0.5 inline-block h-4 w-1.5 bg-accent"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
