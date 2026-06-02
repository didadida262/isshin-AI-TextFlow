import { useTranslationMessages } from "../contexts/I18nContext";

interface AiScriptStepProps {
  title: string;
}

export function AiScriptStep({ title }: AiScriptStepProps) {
  const w = useTranslationMessages().creation.workflow;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="step-panel-title w-fit shrink-0 self-start">{title}</h2>

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/40">
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <p className="max-w-md text-center text-sm leading-relaxed text-text-muted">
            {w.placeholder}
          </p>
        </div>
      </div>
    </div>
  );
}
