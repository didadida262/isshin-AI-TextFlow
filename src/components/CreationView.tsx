import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClapperboard, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

export function CreationView() {
  const i18n = useTranslationMessages();

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black p-6">
      <header className="flex shrink-0 items-center justify-between gap-6">
        <motion.h1
          className="text-2xl font-semibold tracking-tight text-white"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          {i18n.creation.title}
        </motion.h1>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black transition hover:bg-accent/90"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
          {i18n.creation.newProject}
        </motion.button>
      </header>

      <motion.div
        className="mt-6 flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-surface/30 px-6 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.08 }}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-surface">
          <FontAwesomeIcon
            icon={faClapperboard}
            className="text-xl text-text-muted"
          />
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-text-muted">
          {i18n.creation.empty}
        </p>
      </motion.div>
    </main>
  );
}
