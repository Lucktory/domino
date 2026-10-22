import { computeLegalMoves, placeTile, type Move } from "./board.ts";
import { dealHand } from "./deal.ts";
import { getAt, replaceAt } from "./indexing.ts";
import type { Rng } from "./rng.ts";
import { countSides, deriveSide, validateRuleSet, type RuleSet } from "./rules.ts";
import type { Action, ActionResult, HandResult, HandState, MatchState } from "./state.ts";
import { computePipCount } from "./tiles.ts";

export function createMatch(rules: RuleSet, rng: Rng): MatchState {
  const problems = validateRuleSet(rules);
  if (problems.length > 0) throw new Error(`Invalid rules: ${problems.join("; ")}`);
  return {
    rules,
    version: 1,
    handNumber: 1,
    hand: dealHand(rules, rng, null),
    scores: Array.from({ length: countSides(rules) }, () => 0),
    timeoutStrikes: Array.from({ length: rules.seatCount }, () => 0),
    phase: "playing",
    winner: null,
  };
}

export interface AllowedActions {
  readonly legalMoves: readonly Move[];
  readonly canDraw: boolean;
  readonly canPass: boolean;
}

const NOTHING_ALLOWED: AllowedActions = { legalMoves: [], canDraw: false, canPass: false };

/** What `seat` may do right now. The single source for both validation and views. */
export function computeAllowedActions(state: MatchState, seat: number): AllowedActions {
  const { hand, rules } = state;
  if (state.phase !== "playing" || hand.turn !== seat) return NOTHING_ALLOWED;
  const legalMoves = computeLegalMoves(getAt(hand.hands, seat), hand.board, hand.forcedOpeningTileId);
  const stuck = legalMoves.length === 0;
  const canDraw = stuck && rules.whenNoMove === "draw" && hand.stock.length > 0;
  return { legalMoves, canDraw, canPass: stuck && !canDraw };
}

export function applyAction(state: MatchState, seat: number, action: Action, rng: Rng): ActionResult {
  if (action.type === "next-hand") return startNextHand(state, rng);
  const result = applyTurnAction(state, seat, action);
  // Acting resets the seat's consecutive-timeout count.
  if (!result.ok || getAt(result.state.timeoutStrikes, seat) === 0) return result;
  return { ok: true, state: { ...result.state, timeoutStrikes: replaceAt(result.state.timeoutStrikes, seat, 0) } };
}

function applyTurnAction(state: MatchState, seat: number, action: Exclude<Action, { type: "next-hand" }>): ActionResult {
  if (state.phase !== "playing") return { ok: false, error: "not-playing" };
  if (state.hand.turn !== seat) return { ok: false, error: "not-your-turn" };

  const allowed = computeAllowedActions(state, seat);
  const { hand } = state;
  const tiles = getAt(hand.hands, seat);
  let next: HandState;

  switch (action.type) {
    case "play": {
      const tile = tiles.find((t) => t.id === action.tileId);
      if (tile === undefined) return { ok: false, error: "tile-not-in-hand" };
      if (!allowed.legalMoves.some((m) => m.tileId === action.tileId && m.end === action.end)) {
        return { ok: false, error: "illegal-move" };
      }
      const remaining = tiles.filter((t) => t.id !== tile.id);
      next = {
        ...hand,
        hands: replaceAt(hand.hands, seat, remaining),
        board: placeTile(hand.board, tile, action.end),
        openingIndex: action.end === "left" && hand.board.length > 0 ? hand.openingIndex + 1 : hand.openingIndex,
        forcedOpeningTileId: null,
        turn: nextSeat(state, seat),
      };
      if (remaining.length === 0) return { ok: true, state: finishHand(state, next, "domino", deriveSide(state.rules, seat)) };
      break;
    }
    case "draw": {
      const [drawn, ...stock] = hand.stock;
      if (!allowed.canDraw || drawn === undefined) return { ok: false, error: "cannot-draw" };
      next = { ...hand, hands: replaceAt(hand.hands, seat, [...tiles, drawn]), stock };
      break;
    }
    case "pass": {
      if (!allowed.canPass) return { ok: false, error: "cannot-pass" };
      next = { ...hand, turn: nextSeat(state, seat) };
      break;
    }
  }

  if (isBlocked(state.rules, next)) {
    return { ok: true, state: finishHand(state, next, "blocked", resolveBlockedWinner(state.rules, next)) };
  }
  return { ok: true, state: { ...state, version: state.version + 1, hand: next } };
}

/**
 * The seat leaves a match that is not finished and its side loses it at once, without points. With two
 * sides (1 vs 1, or pairs) the other side wins; with three or four players each on their own, the one
 * with the fewest pips among the others wins, and a tie for fewest means nobody wins (user, 2026-10-23).
 */
export function forfeitMatch(state: MatchState, seat: number): ActionResult {
  if (state.phase === "finished") return { ok: false, error: "not-playing" };
  return finishByAbandon(state, seat, "forfeit");
}

/**
 * The seat to move ran out of time (the server keeps the clock). The turn passes to the next seat;
 * after rules.timeoutStrikesToForfeit timeouts in a row the seat's side loses the match.
 */
export function timeoutTurn(state: MatchState): ActionResult {
  if (state.phase !== "playing") return { ok: false, error: "not-playing" };
  const seat = state.hand.turn;
  const timeoutStrikes = replaceAt(state.timeoutStrikes, seat, getAt(state.timeoutStrikes, seat) + 1);
  const struck = { ...state, timeoutStrikes };
  if (getAt(timeoutStrikes, seat) >= state.rules.timeoutStrikesToForfeit) return finishByAbandon(struck, seat, "timeout");
  return {
    ok: true,
    state: {
      ...struck,
      version: state.version + 1,
      // If the opener timed out, the next seat opens with any tile.
      hand: { ...state.hand, turn: nextSeat(state, seat), forcedOpeningTileId: null },
    },
  };
}

function finishByAbandon(state: MatchState, seat: number, kind: "forfeit" | "timeout"): ActionResult {
  getAt(state.hand.hands, seat);
  const winner = lowestSide(computeSidePips(state.rules, state.hand), deriveSide(state.rules, seat));
  const result: HandResult = { kind, winner, points: 0, remainingPips: state.hand.hands.map(computePipCount), leaver: seat };
  return {
    ok: true,
    state: { ...state, version: state.version + 1, hand: { ...state.hand, result }, phase: "finished", winner },
  };
}

function startNextHand(state: MatchState, rng: Rng): ActionResult {
  if (state.phase !== "hand-over") return { ok: false, error: "not-hand-over" };
  if (state.hand.result === null) throw new Error("hand-over without a hand result");
  const { rules } = state;
  // The winning side is a seat here: validateRuleSet rejects previous-winner with pairs.
  const opener =
    rules.match.kind === "points" && rules.match.laterHandsOpener === "previous-winner"
      ? state.hand.result.winner
      : null;
  return {
    ok: true,
    state: {
      ...state,
      version: state.version + 1,
      handNumber: state.handNumber + 1,
      hand: dealHand(rules, rng, opener),
      phase: "playing",
    },
  };
}

/** No seat can play, and nobody can draw. */
function isBlocked(rules: RuleSet, hand: HandState): boolean {
  if (hand.board.length === 0) return false;
  if (rules.whenNoMove === "draw" && hand.stock.length > 0) return false;
  return hand.hands.every((tiles) => computeLegalMoves(tiles, hand.board, null).length === 0);
}

/** Pips left per side (partners added together). */
function computeSidePips(rules: RuleSet, hand: HandState): number[] {
  const totals = Array.from({ length: countSides(rules) }, () => 0);
  hand.hands.forEach((tiles, seat) => {
    const side = deriveSide(rules, seat);
    totals[side] = getAt(totals, side) + computePipCount(tiles);
  });
  return totals;
}

/** The side with the fewest pips, leaving out `excluded` (a side that lost by leaving); a tie means no winner. */
function lowestSide(totals: readonly number[], excluded: number | null): number | null {
  const candidates = totals.flatMap((pips, side) => (side === excluded ? [] : [{ side, pips }]));
  const lowest = Math.min(...candidates.map((c) => c.pips));
  const withLowest = candidates.filter((c) => c.pips === lowest);
  return withLowest.length === 1 ? getAt(withLowest, 0).side : null;
}

/** The side with the fewest pips left wins; a tie for lowest means no winner. */
function resolveBlockedWinner(rules: RuleSet, hand: HandState): number | null {
  return lowestSide(computeSidePips(rules, hand), null);
}

/** The winning side scores the pips left in the hands of every seat on the other sides. */
function finishHand(
  state: MatchState,
  hand: HandState,
  kind: HandResult["kind"],
  winner: number | null,
): MatchState {
  const remainingPips = hand.hands.map(computePipCount);
  const points =
    winner === null ? 0 : remainingPips.reduce((sum, p, seat) => (deriveSide(state.rules, seat) === winner ? sum : sum + p), 0);
  const result: HandResult = { kind, winner, points, remainingPips, leaver: null };
  const scores = winner === null ? state.scores : replaceAt(state.scores, winner, getAt(state.scores, winner) + points);

  const { match } = state.rules;
  const matchOver = match.kind === "single-hand" || (winner !== null && getAt(scores, winner) >= match.target);

  return {
    ...state,
    version: state.version + 1,
    hand: { ...hand, result },
    scores,
    phase: matchOver ? "finished" : "hand-over",
    winner: matchOver ? winner : null,
  };
}

function nextSeat(state: MatchState, seat: number): number {
  return (seat + 1) % state.rules.seatCount;
}
