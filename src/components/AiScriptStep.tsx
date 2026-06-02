import { useTranslationMessages } from "../contexts/I18nContext";
import type { NovelChapterRecord } from "../services/novel";
import { EventChaptersTable } from "./EventChaptersTable";

interface AiScriptStepProps {
  title: string;
  chapters: NovelChapterRecord[];
}

export function AiScriptStep({ title, chapters }: AiScriptStepProps) {
  const w = useTranslationMessages().creation.workflow;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="step-panel-title w-fit shrink-0 self-start">{title}</h2>

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/40">
          <div className="flex min-h-0 flex-1 items-center justify-center px-6">
            <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
              {w.placeholder}
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EventChaptersTable chapters={chapters} showContentColumn={false} />
        </div>
      </div>
    </div>
  );
}
