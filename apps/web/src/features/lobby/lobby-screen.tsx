import type { GameMode } from "@dominio/protocol";
import { images } from "../../assets/index.ts";
import { Avatar } from "../../components/ui/avatar.tsx";
import { LanguageToggle } from "../../components/ui/language-toggle.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";
import type { Messages } from "../../lib/i18n/messages-es.ts";

interface LobbyScreenProps {
  readonly nickname: string;
  readonly pending: boolean;
  readonly onQuickMatch: (mode: GameMode) => void;
  readonly onPrivate: () => void;
  readonly onSignOut: () => void;
}

type MessageKey = { [K in keyof Messages]: Messages[K] extends string ? K : never }[keyof Messages];

interface QuickRoom {
  readonly mode: GameMode;
  readonly title: MessageKey;
  readonly detail: MessageKey;
  readonly art: string;
}

/** Quick-match rooms, in lobby order (the private table sits after 1 vs 1). Hook: .room-mode-<mode>. */
const QUICK_ROOMS: readonly QuickRoom[] = [
  { mode: "1v1", title: "room1v1", detail: "room1v1Detail", art: images.room.oneVsOne },
  { mode: "2v2", title: "room2v2", detail: "room2v2Detail", art: images.room.twoVsTwo },
  { mode: "3p", title: "room3", detail: "room3Detail", art: images.room.threePlayers },
  { mode: "4p", title: "room4", detail: "room4Detail", art: images.room.fourPlayers },
];

/** Card picture: the table for that room. */
function RoomArt({ src }: { readonly src: string }) {
  return <img className="room-art" src={src} alt="" draggable={false} />;
}

function Chevron() {
  return (
    <svg className="room-chevron" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

export function LobbyScreen({ nickname, pending, onQuickMatch, onPrivate, onSignOut }: LobbyScreenProps) {
  const copy = useCopy();
  // 1 vs 1 is the highlighted room (.room-live).
  const quickRoom = (room: QuickRoom) => (
    <li key={room.mode}>
      <button
        type="button"
        className={`room room-mode-${room.mode} ${room.mode === "1v1" ? "room-live" : ""}`}
        disabled={pending}
        onClick={() => {
          onQuickMatch(room.mode);
        }}
      >
        <RoomArt src={room.art} />
        <span className="room-text">
          <span className="room-title">{copy[room.title]}</span>
          <span className="room-detail">{copy[room.detail]}</span>
          <span className="room-cta">{copy.playNow}</span>
        </span>
        <Chevron />
      </button>
    </li>
  );
  return (
    <main className="lobby">
      <header className="lobby-header">
        <Avatar name="" host size="lg" />
        <div className="lobby-host">
          <p className="lobby-host-name">{copy.hostName}</p>
          <p className="lobby-host-role">{copy.hostRole}</p>
        </div>
        <LanguageToggle />
      </header>

      <div className="lobby-player">
        <Avatar name={nickname} size="sm" />
        <p className="lobby-hello">{copy.hello(nickname)}</p>
        <button type="button" className="btn-text" onClick={onSignOut}>
          {copy.signOut}
        </button>
      </div>

      <h1 className="section-title">{copy.chooseRoom}</h1>

      <ul className="rooms">
        {QUICK_ROOMS.slice(0, 1).map(quickRoom)}
        <li>
          <button type="button" className="room" disabled={pending} onClick={onPrivate}>
            <RoomArt src={images.room.private} />
            <span className="room-text">
              <span className="room-title">{copy.roomPrivate}</span>
              <span className="room-detail">{copy.roomPrivateDetail}</span>
            </span>
            <Chevron />
          </button>
        </li>
        {QUICK_ROOMS.slice(1).map(quickRoom)}
      </ul>
    </main>
  );
}
