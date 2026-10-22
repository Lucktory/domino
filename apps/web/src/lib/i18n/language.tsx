import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStored, writeStored } from "../browser-storage.ts";
import { messagesEn } from "./messages-en.ts";
import { messagesEs, type Messages } from "./messages-es.ts";

export type Language = "es" | "en";

export const LANGUAGES: readonly Language[] = ["es", "en"];
/** Players are in Colombia: Spanish unless this device chose otherwise (approved product decision). */
const DEFAULT_LANGUAGE: Language = "es";
const LANGUAGE_KEY = "dominio.language";
const MESSAGES: Readonly<Record<Language, Messages>> = { es: messagesEs, en: messagesEn };
const HTML_LANG: Readonly<Record<Language, string>> = { es: "es-CO", en: "en" };

function isLanguage(value: unknown): value is Language {
  return value === "es" || value === "en";
}

function readLanguage(): Language {
  const stored = readStored(LANGUAGE_KEY);
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

interface LanguageContextValue {
  readonly language: Language;
  readonly setLanguage: (language: Language) => void;
  readonly messages: Messages;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Holds the device's language; every screen reads its text through useCopy(). */
export function LanguageProvider({ children }: { readonly children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readLanguage);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[language];
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      messages: MESSAGES[language],
      setLanguage: (next) => {
        writeStored(LANGUAGE_KEY, next);
        setLanguageState(next);
      },
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (value === null) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}

/** The text for the current language. */
export function useCopy(): Messages {
  return useLanguage().messages;
}
