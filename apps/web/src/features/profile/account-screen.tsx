import { useId, useState, type SubmitEvent } from "react";
import { images } from "../../assets/index.ts";
import { HostBubble } from "../../components/ui/host-bubble.tsx";
import { ScreenHeader } from "../../components/ui/screen-header.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";
import { validateNickname } from "./profile-storage.ts";

interface AccountScreenProps {
  readonly mode: "sign-up" | "sign-in";
  readonly onDone: (nickname: string) => void;
  readonly onBack: () => void;
}

/**
 * Sign up / sign in. For now only the name is used and stored; phone and password are shown for the
 * final look but never read or saved anywhere.
 */
export function AccountScreen({ mode, onDone, onBack }: AccountScreenProps) {
  const copy = useCopy();
  const [name, setName] = useState("");
  const [adult, setAdult] = useState(false);
  // Which errors to show; translated when drawn, so switching language updates them too.
  const [nameInvalid, setNameInvalid] = useState(false);
  const [adultMissing, setAdultMissing] = useState(false);
  const ids = { name: useId(), nameError: useId(), adultError: useId() };
  const signUp = mode === "sign-up";

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nickname = validateNickname(name);
    setNameInvalid(nickname === null);
    const adultOk = !signUp || adult;
    setAdultMissing(!adultOk);
    if (nickname !== null && adultOk) onDone(nickname);
  };

  return (
    <main className="account">
      <ScreenHeader onBack={onBack} />
      {/* Valentina beside the form in landscape (hidden in portrait). */}
      <img className="account-host" src={images.host.wave} alt="" draggable={false} />
      <HostBubble>{signUp ? copy.hostWelcomeSignUp : copy.hostWelcomeSignIn}</HostBubble>

      <form className="account-form panel" onSubmit={submit} noValidate>
        <h1 className="account-title">{signUp ? copy.signUpTitle : copy.signInTitle}</h1>
        <div className="field">
          <label htmlFor={ids.name}>{copy.nameLabel}</label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder={copy.namePlaceholder}
            maxLength={20}
            autoComplete="nickname"
            aria-invalid={nameInvalid}
            aria-describedby={nameInvalid ? ids.nameError : undefined}
          />
          {nameInvalid && (
            <p id={ids.nameError} className="field-error">
              {copy.nameInvalid}
            </p>
          )}
        </div>

        {signUp && (
          <label className="field">
            <span>{copy.phoneLabel}</span>
            <input type="tel" inputMode="tel" placeholder={copy.phonePlaceholder} autoComplete="off" />
          </label>
        )}

        <label className="field">
          <span>{copy.passwordLabel}</span>
          <input type="password" autoComplete="off" />
        </label>

        {signUp && (
          <div className="check">
            <label>
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => {
                  setAdult(e.target.checked);
                }}
                aria-invalid={adultMissing}
                aria-describedby={adultMissing ? ids.adultError : undefined}
              />
              <span>{copy.adultLabel}</span>
            </label>
            {adultMissing && (
              <p id={ids.adultError} className="field-error">
                {copy.adultRequired}
              </p>
            )}
          </div>
        )}

        <button type="submit" className="btn btn-primary">
          {signUp ? copy.signUpSubmit : copy.signInSubmit}
        </button>
      </form>
    </main>
  );
}
