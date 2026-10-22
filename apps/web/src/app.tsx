import { useState } from "react";
import { Toast } from "./components/ui/toast.tsx";
import { useGameConnection, type Notice } from "./features/connection/index.ts";
import { LandingScreen } from "./features/landing/index.ts";
import { LobbyScreen, PrivateRoomScreen, WaitingScreen } from "./features/lobby/index.ts";
import { AccountScreen, clearProfile, readProfile, saveProfile, type Profile } from "./features/profile/index.ts";
import { TableScreen } from "./features/table/index.ts";
import { useCopy } from "./lib/i18n/language.tsx";
import type { Messages } from "./lib/i18n/messages-es.ts";

type Route = "landing" | "sign-up" | "sign-in" | "lobby" | "private";

function noticeText(notice: Notice, copy: Messages): string {
  return notice.key === "error" ? copy.errors[notice.code] : copy[notice.key];
}

export function App() {
  const copy = useCopy();
  const connection = useGameConnection();
  const { status, ready, connectFailed, table, notice, pending } = connection;
  const [profile, setProfile] = useState<Profile | null>(readProfile);
  const [route, setRoute] = useState<Route>(() => (profile === null ? "landing" : "lobby"));

  const signIn = (nickname: string) => {
    setProfile(saveProfile(nickname));
    setRoute("lobby");
  };

  const leaveTable = () => {
    connection.leaveTable();
    setRoute("lobby");
  };

  let screen;
  if (profile === null) {
    screen =
      route === "sign-up" || route === "sign-in" ? (
        <AccountScreen
          key={route}
          mode={route}
          onDone={signIn}
          onBack={() => {
            setRoute("landing");
          }}
        />
      ) : (
        <LandingScreen
          onSignUp={() => {
            setRoute("sign-up");
          }}
          onSignIn={() => {
            setRoute("sign-in");
          }}
        />
      );
  } else if (!ready) {
    screen = (
      <main className="splash" aria-live="polite">
        <p>{connectFailed ? copy.connectFailed : copy.connecting}</p>
      </main>
    );
  } else if (table !== null && table.game === null) {
    screen = <WaitingScreen table={table} pending={pending} onCancel={leaveTable} />;
  } else if (table !== null && table.game !== null) {
    screen = (
      <TableScreen
        table={table}
        game={table.game}
        pending={pending}
        onAct={connection.act}
        onLeave={leaveTable}
        clockOffset={connection.clockOffset}
        onPlayAgain={() => {
          connection.quickMatch(profile.nickname, table.mode);
        }}
      />
    );
  } else if (route === "private") {
    screen = (
      <PrivateRoomScreen
        pending={pending}
        onCreate={() => {
          connection.createPrivateTable(profile.nickname);
        }}
        onJoin={(code) => {
          connection.joinByCode(code, profile.nickname);
        }}
        onBack={() => {
          setRoute("lobby");
        }}
      />
    );
  } else {
    screen = (
      <LobbyScreen
        nickname={profile.nickname}
        pending={pending}
        onQuickMatch={(mode) => {
          connection.quickMatch(profile.nickname, mode);
        }}
        onPrivate={() => {
          setRoute("private");
        }}
        onSignOut={() => {
          clearProfile();
          setProfile(null);
          setRoute("landing");
        }}
      />
    );
  }

  return (
    <>
      {profile !== null && ready && status === "reconnecting" && (
        <div className="banner" role="status">
          {copy.reconnecting}
        </div>
      )}
      {screen}
      {notice !== null && <Toast message={noticeText(notice, copy)} dismissLabel={copy.dismiss} onDismiss={connection.dismissNotice} />}
    </>
  );
}
