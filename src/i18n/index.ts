import { en } from "./locales/en";
import { zh, type TranslationSchema } from "./locales/zh";

export type Locale = "zh" | "en";

export const LOCALE_STORAGE_KEY = "textflow-locale";

const locales: Record<Locale, TranslationSchema> = { zh, en };

export function getStoredLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "en" ? "en" : "zh";
}

export function getTranslations(locale: Locale): TranslationSchema {
  return locales[locale];
}

type TranslationParams = Record<string, string | number>;

function resolvePath(obj: TranslationSchema, path: string): string {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);

  return typeof value === "string" ? value : path;
}

export function translate(
  locale: Locale,
  key: string,
  params?: TranslationParams,
): string {
  let text = resolvePath(getTranslations(locale), key);
  if (!params) return text;

  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{{${name}}}`, String(value));
  }
  return text;
}
