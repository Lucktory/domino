import type { PlayerView, RuleErrorCode } from "@dominio/engine";
import type { GameActionInput, GameMode, JoinTableInput, LeaveTableInput, PlayerNameInput, QuickMatchInput } from "./client-events.ts";

export interface SeatView {
  readonly nickname: string;
  readonly connected: boolean;
}

/** What one player sees of a table: the lobby part, plus their game view once play starts. */
export interface TableView {
  readonly tableId: string;
  readonly code: string;
  /** public: found by quick match. private: joined with the code. */
  readonly visibility: "public" | "private";
  readonly mode: GameMode;
  readonly yourSeat: number;
  /** null = empty seat. */
  readonly seats: readonly (SeatView | null)[];
  readonly game: PlayerView | null;
  /** Server time (ms) when the player to move runs out of time; null when nobody is on the clock. */
  readonly turnDeadline: number | null;
  /** Server time (ms) when this view was sent, so the phone can correct for its own clock. */
  readonly serverNow: number;
}

export interface SessionInfo {
  readonly token: string;
  readonly playerId: string;
}

export type ErrorCode =
  | RuleErrorCode
  | "invalid-input"
  | "table-not-found"
  | "table-full"
  | "not-seated"
  | "not-started"
  | "stale-version"
  | "already-playing"
  | "internal";

export type Ack<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: ErrorCode };

/** Sent by the phone in the Socket.IO handshake. */
export interface HandshakeAuth {
  readonly token?: string;
}

export interface ServerToClientEvents {
  session: (session: SessionInfo) => void;
  /**
   * The one table this player should see, sent first on every (re)connect. null = none
   * (left, finished and left, or lost when the server restarted). The client adopts tables only from
   * this event and from create/join/quick replies; table:state only updates the table already shown.
   */
  "table:current": (table: TableView | null) => void;
  "table:state": (table: TableView) => void;
}

export interface ClientToServerEvents {
  "table:create": (input: PlayerNameInput, ack: (result: Ack<TableView>) => void) => void;
  "match:quick": (input: QuickMatchInput, ack: (result: Ack<TableView>) => void) => void;
  "table:join": (input: JoinTableInput, ack: (result: Ack<TableView>) => void) => void;
  "table:leave": (input: LeaveTableInput, ack: (result: Ack<null>) => void) => void;
  "game:action": (input: GameActionInput, ack: (result: Ack<null>) => void) => void;
}
