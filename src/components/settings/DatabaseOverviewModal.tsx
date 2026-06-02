import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../../contexts/I18nContext";
import type { DatabaseOverview } from "../../services/databaseAdmin";
import { ModalPortal } from "../ModalPortal";

interface DatabaseOverviewModalProps {
  overview: DatabaseOverview | null;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

export function DatabaseOverviewModal({
  overview,
  onClose,
}: DatabaseOverviewModalProps) {
  const db = useTranslationMessages().settings.database;

  return (
    <ModalPortal>
      <AnimatePresence>
        {overview ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label={db.close}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative z-10 flex max-h-[min(520px,calc(100dvh-7rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
            >
              <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <h3 className="text-base font-semibold text-white">
                  {db.overviewModalTitle}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <p className="mb-4 text-xs text-text-muted">
                  {db.dbPathLabel}:{" "}
                  <span className="break-all text-text-dim">{overview.dbPath}</span>
                </p>

                <div className="overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.03] text-left text-xs text-text-muted">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">{db.tableName}</th>
                        <th className="px-4 py-2.5 font-medium">{db.rowCount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.tables.map((table) => (
                        <tr
                          key={table.name}
                          className="border-t border-white/5 text-white"
                        >
                          <td className="px-4 py-2.5 font-mono text-xs">{table.name}</td>
                          <td className="px-4 py-2.5">{table.rowCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <footer className="flex shrink-0 justify-end border-t border-white/10 px-5 py-3.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white"
                >
                  {db.close}
                </button>
              </footer>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
