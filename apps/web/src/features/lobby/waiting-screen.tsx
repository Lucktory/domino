import type { TableView } from "@dominio/protocol";
import { useState } from "react";
import { images } from "../../assets/index.ts";
import { Avatar } from "../../components/ui/avatar.tsx";
import { TileBack } from "../../components/ui/domino-tile.tsx";
import { LanguageToggle } from "../../components/ui/language-toggle.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";

interface WaitingScreenProps {
  readonly table: TableView;
  readonly pending: boolean;
  readonly onCancel: () => void;
}

type CopyState = "idle" | "copied" | "failed";

/** Public table: searching for a rival. Private table: show the code to share. */
export function WaitingScreen({ table, pending, onCancel }: WaitingScreenProps) {
  const copy = useCopy();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const searching = table.visibility === "public";
  // More than two seats: say how many have sat down so far.
  const manySeats = table.seats.length > 2;
  const seated = table.seats.filter((seat) => seat !== null).length;
  const me = table.seats[table.yourSeat];
  if (me === undefined || me === null) throw new Error("waiting at a table without our seat");

  const copyCode = () => {
    navigator.clipboard.writeText(table.code).then(
      () => {
        setCopyState("copied");
      },
      (error: unknown) => {
        console.warn("clipboard write failed", error);
        setCopyState("failed");
      },
    );
  };

  return (
    <main className="waiting">
      <div className="top-row top-row-end">
        <LanguageToggle />
      </div>
      {/* Two columns in landscape; in portrait both wrappers are display: contents (one column). */}
      <div className="waiting-side">
        <img className="waiting-host" src={searching ? images.host.think : images.host.wave} alt="" draggable={false} />
        <div className="versus" aria-hidden="true">
          <Avatar name={me.nickname} size="lg" />
          <img className="versus-emblem" src={images.vs} alt="" draggable={false} />
          <span className="versus-unknown">
            <TileBack className="versus-shuffle" />
          </span>
        </div>
      </div>

      <div className="waiting-main">
        {searching ? (
          <>
            <h1 className="section-title" aria-live="polite">
              {manySeats ? copy.searchingPlayersTitle : copy.searchingTitle}
            </h1>
            <p className="muted" aria-live="polite">
              {manySeats ? copy.playersFound(seated, table.seats.length) : copy.searchingDetail}
            </p>
          </>
        ) : (
          <>
            <h1 className="section-title">{copy.waitingTitle}</h1>
            <p className="muted">{copy.waitingHint}</p>
            <div className="code-box panel">
              <p className="table-code" aria-label={`${copy.codeLabel}: ${table.code.replace(/(.)(?=.)/g, "$1 ")}`}>
                {table.code}
              </p>
            </div>
            <button type="button" className="btn btn-primary btn-wide" onClick={copyCode}>
              {copyState === "copied" ? copy.copied : copy.copyCode}
            </button>
            {copyState === "failed" && <p className="field-error">{copy.copyFailed}</p>}
          </>
        )}

        <button type="button" className="btn btn-ghost btn-wide" disabled={pending} onClick={onCancel}>
          {copy.cancel}
        </button>
      </div>
    </main>
  );
}
