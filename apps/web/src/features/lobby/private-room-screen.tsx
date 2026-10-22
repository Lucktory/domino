import { TABLE_CODE_ALPHABET, TABLE_CODE_LENGTH } from "@dominio/protocol";
import { useId, useState, type SubmitEvent } from "react";
import { ScreenHeader } from "../../components/ui/screen-header.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";

interface PrivateRoomScreenProps {
  readonly pending: boolean;
  readonly onCreate: () => void;
  readonly onJoin: (code: string) => void;
  readonly onBack: () => void;
}

const NOT_IN_ALPHABET = new RegExp(`[^${TABLE_CODE_ALPHABET}]`, "g");

/** Keeps only characters that can appear in a code, uppercased (spaces and dashes are dropped). */
function sanitizeCode(raw: string): string {
  return raw.toUpperCase().replace(NOT_IN_ALPHABET, "").slice(0, TABLE_CODE_LENGTH);
}

export function PrivateRoomScreen({ pending, onCreate, onJoin, onBack }: PrivateRoomScreenProps) {
  const copy = useCopy();
  const [code, setCode] = useState("");
  const codeId = useId();

  const join = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.length === TABLE_CODE_LENGTH) onJoin(code);
  };

  return (
    <main className="private">
      <ScreenHeader onBack={onBack} />
      <h1 className="section-title">{copy.privateTitle}</h1>

      <section className="private-block panel">
        <button type="button" className="btn btn-primary btn-wide" disabled={pending} onClick={onCreate}>
          {copy.privateCreate}
        </button>
        <p className="muted">{copy.privateCreateDetail}</p>
      </section>

      <form className="private-block private-join panel" onSubmit={join}>
        <h2 className="block-title">{copy.privateJoinTitle}</h2>
        <div className="field">
          <label htmlFor={codeId}>{copy.codeLabel}</label>
          <input
            id={codeId}
            value={code}
            onChange={(e) => {
              setCode(sanitizeCode(e.target.value));
            }}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="code-input"
          />
        </div>
        <button type="submit" className="btn btn-wide" disabled={pending || code.length !== TABLE_CODE_LENGTH}>
          {copy.join}
        </button>
      </form>
    </main>
  );
}
