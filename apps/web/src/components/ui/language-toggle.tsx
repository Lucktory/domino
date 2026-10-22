import { LANGUAGES, useLanguage } from "../../lib/i18n/language.tsx";

/** ES | EN switch. The choice is remembered on this device. */
export function LanguageToggle({ className }: { readonly className?: string }) {
  const { language, setLanguage, messages } = useLanguage();
  return (
    <div className={`lang-toggle ${className ?? ""}`} role="group" aria-label={messages.languageLabel}>
      {LANGUAGES.map((option) => (
        <button
          key={option}
          type="button"
          className="lang-option"
          lang={option}
          aria-pressed={option === language}
          aria-label={messages.languageNames[option]}
          onClick={() => {
            setLanguage(option);
          }}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
