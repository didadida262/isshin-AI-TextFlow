import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faImage,
  faSpinner,
  faVideo,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import {
  useGenerationJobs,
  type GenerationJob,
} from "../contexts/GenerationJobsContext";
import { ModalPortal } from "./ModalPortal";

const overlayExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveErrorMessage(
  code: string | undefined,
  errors: ReturnType<typeof useTranslationMessages>["errors"],
): string {
  if (!code) return errors.requestFailed.replace("{{error}}", "");
  if (code === "IMAGE_CONFIG_REQUIRED") return errors.imageConfigRequired;
  if (code === "VIDEO_CONFIG_REQUIRED") return errors.videoConfigRequired;
  return code;
}

function JobCard({
  job,
  onOpen,
  onDismiss,
}: {
  job: GenerationJob;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const n = useTranslationMessages().notifications;
  const errors = useTranslationMessages().errors;
  const isRunning = job.status === "running";
  const isSuccess = job.status === "success";
  const canOpen = !isRunning;

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        !job.read && !isRunning
          ? "border-accent/30 bg-accent/5"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isSuccess
              ? "bg-accent/15 text-accent"
              : isRunning
                ? "bg-white/5 text-text-muted"
                : "bg-red-500/15 text-red-400"
          }`}
        >
          <FontAwesomeIcon
            icon={
              isRunning
                ? faSpinner
                : isSuccess
                  ? job.kind === "video"
                    ? faVideo
                    : faImage
                  : faCircleExclamation
            }
            className={isRunning ? "animate-spin text-xs" : "text-xs"}
          />
        </div>

        <button
          type="button"
          disabled={!canOpen}
          onClick={onOpen}
          className={`min-w-0 flex-1 text-left ${canOpen ? "cursor-pointer" : "cursor-default"}`}
        >
          <p className="truncate text-sm font-medium text-white">{job.itemName}</p>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {job.projectName} ·{" "}
            {job.kind === "video" ? n.typeVideo : n.typeImage}
          </p>
          <p className="mt-1.5 text-xs">
            {isRunning ? (
              <span className="text-text-muted">{n.statusRunning}</span>
            ) : isSuccess ? (
              <span className="inline-flex items-center gap-1 text-accent">
                <FontAwesomeIcon icon={faCircleCheck} className="text-[10px]" />
                {n.statusSuccess}
              </span>
            ) : (
              <span className="text-red-400">
                {resolveErrorMessage(job.errorMessage, errors)}
              </span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-text-dim">
            {formatTime(job.completedAt ?? job.createdAt)}
          </p>
        </button>

        {!isRunning ? (
          <button
            type="button"
            onClick={onDismiss}
            title={n.dismiss}
            aria-label={n.dismiss}
            className="shrink-0 rounded-md p-1 text-text-dim transition hover:bg-white/5 hover:text-white"
          >
            <FontAwesomeIcon icon={faXmark} className="text-xs" />
          </button>
        ) : null}
      </div>

      {canOpen && isSuccess ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2.5 w-full rounded-lg border border-accent/30 px-3 py-1.5 text-xs text-accent transition hover:bg-accent/10"
        >
          {n.viewResult}
        </button>
      ) : null}
    </div>
  );
}

export function GenerationNotificationsPanel() {
  const n = useTranslationMessages().notifications;
  const {
    jobs,
    panelOpen,
    setPanelOpen,
    navigateToJob,
    markAllRead,
    dismissJob,
  } = useGenerationJobs();

  const handleClose = () => setPanelOpen(false);

  return (
    <ModalPortal>
      <AnimatePresence>
        {panelOpen ? (
          <motion.div
            key="generation-notifications"
            className="fixed inset-0 z-[65] flex justify-end"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayExit}
          >
            <button
              type="button"
              aria-label={n.close}
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              onClick={handleClose}
            />

            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="generation-notifications-title"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#111111] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <h2
                  id="generation-notifications-title"
                  className="text-base font-semibold text-white"
                >
                  {n.title}
                </h2>
                <div className="flex items-center gap-2">
                  {jobs.some((job) => !job.read && job.status !== "running") ? (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="rounded-lg px-2.5 py-1 text-xs text-text-muted transition hover:bg-white/5 hover:text-white"
                    >
                      {n.markAllRead}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label={n.close}
                    className="rounded-md p-1.5 text-text-muted transition hover:bg-white/5 hover:text-white"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {jobs.length === 0 ? (
                  <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
                    <p className="text-sm text-text-muted">{n.empty}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onOpen={() => navigateToJob(job)}
                        onDismiss={() => dismissJob(job.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
