import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import { useI18n } from "../contexts/I18nContext";

interface LanguageToggleProps {
  className?: string;
  compact?: boolean;
}

export function LanguageToggle({ className = "", compact = false }: LanguageToggleProps) {
  const { locale, toggleLocale, t } = useI18n();
  const label =
    locale === "zh" ? t("language.switchToEn") : t("language.switchToZh");

  return (
    <button
      type="button"
      onClick={toggleLocale}
      title={label}
      aria-label={label}
      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-text-muted transition hover:bg-white/5 hover:text-white ${className}`}
    >
      <FontAwesomeIcon icon={faGlobe} className="text-sm text-accent" />
      {!compact && (
        <span className="text-[10px] font-medium uppercase tracking-wide text-text-dim">
          {locale === "zh" ? "中" : "EN"}
        </span>
      )}
    </button>
  );
}
