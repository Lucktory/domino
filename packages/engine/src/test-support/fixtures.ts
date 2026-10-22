import { placeTile } from "../board.ts";
import { applyAction } from "../match.ts";
import type { Rng } from "../rng.ts";
import { countSides, type RuleSet } from "../rules.ts";
import type { Action, MatchState, PlacedTile } from "../state.ts";
import { createTile, type Tile } from "../tiles.ts";

export const ONE_VS_ONE_DRAW: RuleSet = {
  seatCount: 2,
  teams: "none",
  tilesPerPlayer: 7,
  whenNoMove: "draw",
  opening: "highest-double",
  match: { kind: "single-hand" },
  turnSeconds: 15,
  timeoutStrikesToForfeit: 2,
};

export const ONE_VS_ONE_PASS: RuleSet = { ...ONE_VS_ONE_DRAW, whenNoMove: "pass" };

/** 2 vs 2: partners opposite, every tile dealt, so a player with no move passes. */
export const PAIRS: RuleSet = { ...ONE_VS_ONE_PASS, seatCount: 4, teams: "pairs" };

/** Applies an action the test expects to be accepted; a rejection fails the test with its error code. */
export function applyOrThrow(state: MatchState, seat: number, action: Action, rng: Rng): MatchState {
  const result = applyAction(state, seat, action, rng);
  if (!result.ok) throw new Error(`expected success, got ${result.error}`);
  return result.state;
}

/** "3-5" -> tile. */
export function t(id: string): Tile {
  const [a, b] = id.split("-").map(Number);
  if (a === undefined || b === undefined) throw new Error(`bad tile id ${id}`);
  return createTile(a, b);
}

/** Board built by playing tiles left to right, e.g. ["6-6", "6-3"]. */
export function boardOf(ids: string[]): PlacedTile[] {
  return ids.reduce<PlacedTile[]>((board, id) => placeTile(board, t(id), "right"), []);
}

interface MatchSetup {
  rules?: RuleSet;
  hands: string[][];
  stock?: string[];
  board?: string[];
  turn?: number;
  scores?: number[];
}

/** A mid-hand state for unit tests. */
export function buildMatch(setup: MatchSetup): MatchState {
  const rules = setup.rules ?? ONE_VS_ONE_DRAW;
  return {
    rules,
    version: 1,
    handNumber: 1,
    hand: {
      hands: setup.hands.map((ids) => ids.map(t)),
      stock: (setup.stock ?? []).map(t),
      board: boardOf(setup.board ?? []),
      openingIndex: 0,
      turn: setup.turn ?? 0,
      forcedOpeningTileId: null,
      result: null,
    },
    scores: setup.scores ?? Array.from({ length: countSides(rules) }, () => 0),
    timeoutStrikes: setup.hands.map(() => 0),
    phase: "playing",
    winner: null,
  };
}
