import { images } from "../../assets/index.ts";
import { useCopy } from "../../lib/i18n/language.tsx";
import { LanguageToggle } from "./language-toggle.tsx";

/** Back link, language toggle and the gold logo: the top of every secondary screen. */
export function ScreenHeader({ onBack }: { readonly onBack: () => void }) {
  const copy = useCopy();
  return (
    <>
      <div className="top-row">
        <button type="button" className="link-back" onClick={onBack}>
          {copy.back}
        </button>
        <LanguageToggle />
      </div>
      <img className="screen-logo" src={images.logo} alt={copy.appName} />
    </>
  );
}
