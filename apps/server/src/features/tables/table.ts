import type { MatchState, RuleSet } from "@dominio/engine";
import type { GameMode } from "@dominio/protocol";

export interface Seat {
  readonly playerId: string;
  readonly nickname: string;
  readonly connected: boolean;
  /** The player left this table; it is never restored to them and they receive no more updates. */
  readonly left: boolean;
}

/** public: filled by quick match. private: joined only with its code. */
export type TableVisibility = "public" | "private";

export interface Table {
  readonly id: string;
  readonly code: string;
  readonly visibility: TableVisibility;
  readonly mode: GameMode;
  /** The rules of this table's mode, fixed when the table opens. */
  readonly rules: RuleSet;
  /** One entry per seat; null = empty. */
  readonly seats: readonly (Seat | null)[];
  /** null until every seat is taken. */
  readonly match: MatchState | null;
  /** Server time (ms) when the player to move runs out of time; null when nobody is on the clock. */
  readonly turnDeadline: number | null;
  /** Everyone left before the match started; the table can no longer be joined. */
  readonly closed: boolean;
}

export function findSeat(table: Table, playerId: string): number | null {
  const index = table.seats.findIndex((seat) => seat?.playerId === playerId);
  return index < 0 ? null : index;
}

/** The player sits at this table, has not left it, and it is still open or in play. */
export function isActiveSeatOf(table: Table, playerId: string): boolean {
  const seat = findSeat(table, playerId);
  return seat !== null && table.seats[seat]?.left === false && !table.closed;
}

/** Waiting for players: no match yet and not closed. */
export function isWaiting(table: Table): boolean {
  return table.match === null && !table.closed;
}
