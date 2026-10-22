import type { Move } from "./board.ts";
import { getAt } from "./indexing.ts";
import { computeAllowedActions } from "./match.ts";
import type { RuleSet } from "./rules.ts";
import type { HandResult, MatchState, PlacedTile } from "./state.ts";
import type { Tile } from "./tiles.ts";

/** Everything one seat is allowed to know. */
export interface PlayerView {
  readonly seat: number;
  readonly rules: RuleSet;
  readonly version: number;
  readonly handNumber: number;
  readonly phase: MatchState["phase"];
  readonly turn: number;
  readonly hand: readonly Tile[];
  /** tileCounts[seat] = how many tiles that seat holds. */
  readonly tileCounts: readonly number[];
  readonly stockCount: number;
  readonly board: readonly PlacedTile[];
  /** Index in board of the first tile played, so the board can be laid out from the center. */
  readonly openingIndex: number;
  readonly legalMoves: readonly Move[];
  readonly canDraw: boolean;
  readonly canPass: boolean;
  /** Per side (see deriveSide). */
  readonly scores: readonly number[];
  /** Consecutive timeouts per seat (public: both players see the warning). */
  readonly timeoutStrikes: readonly number[];
  readonly handResult: HandResult | null;
  /** Every seat's remaining tiles, only once the hand is over. */
  readonly revealedHands: readonly (readonly Tile[])[] | null;
  /** The side that won the match. */
  readonly matchWinner: number | null;
}

/**
 * The only function that turns match state into what a player sees.
 * Other seats' tiles and the stock never leave the server while a hand is in play.
 */
export function viewFor(state: MatchState, seat: number): PlayerView {
  const { hand } = state;
  const allowed = computeAllowedActions(state, seat);
  return {
    seat,
    rules: state.rules,
    version: state.version,
    handNumber: state.handNumber,
    phase: state.phase,
    turn: hand.turn,
    hand: getAt(hand.hands, seat),
    tileCounts: hand.hands.map((tiles) => tiles.length),
    stockCount: hand.stock.length,
    board: hand.board,
    openingIndex: hand.openingIndex,
    legalMoves: allowed.legalMoves,
    canDraw: allowed.canDraw,
    canPass: allowed.canPass,
    scores: state.scores,
    timeoutStrikes: state.timeoutStrikes,
    handResult: hand.result,
    revealedHands: hand.result === null ? null : hand.hands,
    matchWinner: state.winner,
  };
}
