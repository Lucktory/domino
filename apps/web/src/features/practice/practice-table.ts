import { viewFor, type MatchState, type PlayerView } from "@dominio/engine";
import type { GameMode, TableView } from "@dominio/protocol";

/** In a game against the computer the player always sits at seat 0; computer players take the others. */
export const HUMAN_SEAT = 0;

/**
 * The same picture the server would send, built from the local match, so the table and result screens
 * show a game against the computer without knowing the difference. No turn clock (turnDeadline null).
 */
export function buildPracticeTable(
  match: MatchState,
  mode: GameMode,
  names: readonly string[],
  now: number,
): { readonly table: TableView; readonly game: PlayerView } {
  if (names.length !== match.rules.seatCount) {
    throw new Error(`practice table needs ${match.rules.seatCount} names, got ${names.length}`);
  }
  const game = viewFor(match, HUMAN_SEAT);
  const table: TableView = {
    tableId: "practice",
    code: "",
    visibility: "public",
    mode,
    yourSeat: HUMAN_SEAT,
    seats: names.map((nickname) => ({ nickname, connected: true })),
    game,
    turnDeadline: null,
    serverNow: now,
  };
  return { table, game };
}
