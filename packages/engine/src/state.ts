import type { RuleSet } from "./rules.ts";
import type { Tile, TileId } from "./tiles.ts";

export type BoardEnd = "left" | "right";

/** A tile on the board, oriented: `left` faces the left end of the chain. */
export interface PlacedTile {
  readonly tile: Tile;
  readonly left: number;
  readonly right: number;
}

export interface HandResult {
  /**
   * forfeit: a player left the match. timeout: a player ran out of time too many times in a row.
   * In both the other side wins at once and scores nothing.
   */
  readonly kind: "domino" | "blocked" | "forfeit" | "timeout";
  /** The winning side (see deriveSide: the seat, or the team in pairs); null when a blocked hand ends tied. */
  readonly winner: number | null;
  readonly points: number;
  /** Per seat. */
  readonly remainingPips: readonly number[];
  /** The seat that left or ran out of time (forfeit, timeout); null when the hand was played out. */
  readonly leaver: number | null;
}

export interface HandState {
  /** hands[seat] = tiles held by that seat. */
  readonly hands: readonly (readonly Tile[])[];
  /** Undealt tiles. Drawable only when rules.whenNoMove is "draw". */
  readonly stock: readonly Tile[];
  /** Left to right. */
  readonly board: readonly PlacedTile[];
  /** Index in board of the first tile played; grows by one with each tile played on the left end. */
  readonly openingIndex: number;
  readonly turn: number;
  /** Set until the opening tile is played when the rules force a specific one. */
  readonly forcedOpeningTileId: TileId | null;
  readonly result: HandResult | null;
}

export interface MatchState {
  readonly rules: RuleSet;
  /** Increments on every accepted action. Clients send it back to reject stale actions. */
  readonly version: number;
  readonly handNumber: number;
  readonly hand: HandState;
  /** Per side (see deriveSide). */
  readonly scores: readonly number[];
  /** Consecutive timeouts per seat; a seat's own action resets its count. */
  readonly timeoutStrikes: readonly number[];
  readonly phase: "playing" | "hand-over" | "finished";
  /** The side that won the match. */
  readonly winner: number | null;
}

export type Action =
  | { readonly type: "play"; readonly tileId: TileId; readonly end: BoardEnd }
  | { readonly type: "draw" }
  | { readonly type: "pass" }
  | { readonly type: "next-hand" };

export type RuleErrorCode =
  | "not-your-turn"
  | "tile-not-in-hand"
  | "illegal-move"
  | "cannot-draw"
  | "cannot-pass"
  | "not-playing"
  | "not-hand-over";

export type ActionResult =
  | { readonly ok: true; readonly state: MatchState }
  | { readonly ok: false; readonly error: RuleErrorCode };
