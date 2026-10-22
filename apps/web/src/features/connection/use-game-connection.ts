import type { Action } from "@dominio/engine";
import type { Ack, ErrorCode, GameMode, TableView } from "@dominio/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { createGameSocket, type GameSocket } from "../../lib/socket.ts";
import { adoptTable, applyTableUpdate } from "./table-sync.ts";

type ConnectionStatus = "connecting" | "connected" | "reconnecting";

const ACK_TIMEOUT_MS = 10_000;
const NOTICE_MS = 4500;
/** Errors meaning the server no longer has this table for the player (e.g. it restarted). */
const TABLE_GONE: readonly ErrorCode[] = ["table-not-found", "not-seated"];

/** What to tell the player; turned into text in the current language when shown. */
export type Notice =
  | { readonly key: "tableGone" }
  | { readonly key: "connectionFailed" }
  | { readonly key: "error"; readonly code: ErrorCode };

export interface GameConnection {
  readonly status: ConnectionStatus;
  /** The server said which table (if any) to show; until then the app shows a splash. */
  readonly ready: boolean;
  /** A connection attempt failed before the first successful one. */
  readonly connectFailed: boolean;
  readonly table: TableView | null;
  /**
   * Server clock minus this phone's clock (ms), from the latest view. Add it to Date.now() to read the
   * server's time for the turn countdown (network delay makes it a few ms generous).
   */
  readonly clockOffset: number;
  /** Short message for the player; clears itself. */
  readonly notice: Notice | null;
  /** A request is waiting for the server; buttons disable so taps do not stack. */
  readonly pending: boolean;
  quickMatch: (nickname: string, mode: GameMode) => void;
  createPrivateTable: (nickname: string) => void;
  joinByCode: (code: string, nickname: string) => void;
  act: (action: Action) => void;
  leaveTable: () => void;
  dismissNotice: () => void;
}

/** Owns the socket for the app's lifetime and the one table the player is at. */
export function useGameConnection(): GameConnection {
  const socketRef = useRef<GameSocket | null>(null);
  const tableRef = useRef<TableView | null>(null);
  const pendingCount = useRef(0);
  const actionInFlight = useRef(false);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [ready, setReady] = useState(false);
  const [connectFailed, setConnectFailed] = useState(false);
  const [table, setTableState] = useState<TableView | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(false);

  const [clockOffset, setClockOffset] = useState(0);

  const setTable = useCallback((next: TableView | null) => {
    tableRef.current = next;
    setTableState(next);
  }, []);

  const noteServerTime = useCallback((view: TableView) => {
    setClockOffset(view.serverNow - Date.now());
  }, []);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, NOTICE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  useEffect(() => {
    const socket = createGameSocket();
    socketRef.current = socket;
    socket.on("connect", () => {
      setStatus("connected");
      setConnectFailed(false);
      setNotice((current) => (current?.key === "connectionFailed" ? null : current));
    });
    socket.on("connect_error", (error) => {
      console.warn("connection attempt failed", error.message);
      setConnectFailed(true);
    });
    socket.on("disconnect", () => {
      setStatus("reconnecting");
    });
    socket.on("table:current", (current) => {
      setReady(true);
      if (current !== null) {
        noteServerTime(current);
        setTable(adoptTable(tableRef.current, current));
      } else if (tableRef.current !== null) {
        setTable(null);
        setNotice({ key: "tableGone" });
      }
    });
    socket.on("table:state", (incoming) => {
      noteServerTime(incoming);
      setTable(applyTableUpdate(tableRef.current, incoming));
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setTable, noteServerTime]);

  /** Sends a request; shows its error, or calls onData when it succeeds. */
  const request = useCallback(
    <T>(
      send: (socket: ReturnType<GameSocket["timeout"]>) => Promise<Ack<T>>,
      onData: (data: T) => void,
      onError?: (error: ErrorCode) => boolean,
    ): Promise<void> => {
      const socket = socketRef.current;
      if (socket === null) return Promise.resolve();
      pendingCount.current += 1;
      setPending(true);
      return send(socket.timeout(ACK_TIMEOUT_MS))
        .then((result) => {
          if (result.ok) {
            onData(result.data);
          } else if (onError?.(result.error) !== true) {
            setNotice({ key: "error", code: result.error });
          }
        })
        .catch((failure: unknown) => {
          console.error("request failed", failure);
          setNotice({ key: "connectionFailed" });
        })
        .finally(() => {
          pendingCount.current -= 1;
          setPending(pendingCount.current > 0);
        });
    },
    [],
  );

  const showReply = useCallback(
    (view: TableView) => {
      noteServerTime(view);
      setTable(adoptTable(tableRef.current, view));
    },
    [setTable, noteServerTime],
  );

  /** The server no longer has the table: back to the lobby, and say why. */
  const handleTableGone = useCallback(
    (error: ErrorCode): boolean => {
      if (!TABLE_GONE.includes(error)) return false;
      setTable(null);
      setNotice({ key: "tableGone" });
      return true;
    },
    [setTable],
  );

  return {
    status,
    ready,
    connectFailed,
    table,
    clockOffset,
    notice,
    pending,
    quickMatch: (nickname, mode) => {
      void request((s) => s.emitWithAck("match:quick", { nickname, mode }), showReply);
    },
    createPrivateTable: (nickname) => {
      void request((s) => s.emitWithAck("table:create", { nickname }), showReply);
    },
    joinByCode: (code, nickname) => {
      void request((s) => s.emitWithAck("table:join", { code, nickname }), showReply);
    },
    act: (action) => {
      const current = tableRef.current;
      // One action at a time: a double tap must not send the same move twice.
      if (current === null || current.game === null || actionInFlight.current) return;
      actionInFlight.current = true;
      const input = { tableId: current.tableId, expectedVersion: current.game.version, action };
      void request((s) => s.emitWithAck("game:action", input), () => undefined, handleTableGone).finally(() => {
        actionInFlight.current = false;
      });
    },
    leaveTable: () => {
      const current = tableRef.current;
      if (current === null) return;
      void request(
        (s) => s.emitWithAck("table:leave", { tableId: current.tableId }),
        () => {
          setTable(null);
        },
        (error) => {
          // Already gone on the server: leaving is done either way.
          if (!TABLE_GONE.includes(error)) return false;
          setTable(null);
          return true;
        },
      );
    },
    dismissNotice: () => {
      setNotice(null);
    },
  };
}
