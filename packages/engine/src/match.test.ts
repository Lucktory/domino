import { describe, expect, it } from "vitest";
import { applyAction, computeAllowedActions, createMatch, forfeitMatch, timeoutTurn } from "./match.ts";
import type { Action, MatchState } from "./state.ts";
import { applyOrThrow, buildMatch, ONE_VS_ONE_DRAW, ONE_VS_ONE_PASS } from "./test-support/fixtures.ts";
import { createSeededRng } from "./test-support/rng.ts";

const rng = createSeededRng(1);

const apply = (state: MatchState, seat: number, action: Action) => applyOrThrow(state, seat, action, rng);

function rejection(state: MatchState, seat: number, action: Action) {
  const result = applyAction(state, seat, action, rng);
  return result.ok ? "accepted" : result.error;
}

describe("createMatch", () => {
  it("rejects rules that cannot be dealt", () => {
    expect(() => createMatch({ ...ONE_VS_ONE_DRAW, tilesPerPlayer: 15 }, rng)).toThrow(/must not exceed 28/);
    expect(() => createMatch({ ...ONE_VS_ONE_DRAW, seatCount: 5 }, rng)).toThrow(/seatCount/);
  });

  it("starts at version 1 with zero scores", () => {
    const match = createMatch(ONE_VS_ONE_DRAW, rng);
    expect(match).toMatchObject({ version: 1, handNumber: 1, phase: "playing", scores: [0, 0], winner: null });
  });
});

describe("play", () => {
  const state = buildMatch({ hands: [["6-3", "1-1"], ["5-5", "2-4"]], board: ["6-6"], stock: ["0-0"] });

  it("rejects a seat playing out of turn", () => {
    expect(rejection(state, 1, { type: "play", tileId: "5-5", end: "left" })).toBe("not-your-turn");
  });

  it("rejects a tile the seat does not hold", () => {
    expect(rejection(state, 0, { type: "play", tileId: "5-5", end: "left" })).toBe("tile-not-in-hand");
  });

  it("rejects a tile that does not fit that end", () => {
    expect(rejection(state, 0, { type: "play", tileId: "1-1", end: "left" })).toBe("illegal-move");
  });

  it("places the tile, passes the turn and bumps the version", () => {
    const next = apply(state, 0, { type: "play", tileId: "3-6", end: "right" });
    expect(next.hand.board.map((p) => [p.left, p.right])).toEqual([[6, 6], [6, 3]]);
    expect(next.hand.hands[0]?.map((x) => x.id)).toEqual(["1-1"]);
    expect(next.hand.turn).toBe(1);
    expect(next.version).toBe(state.version + 1);
  });

  it("enforces the forced opening tile", () => {
    const opening = buildMatch({ hands: [["6-6", "1-2"], ["3-4"]] });
    const forced = { ...opening, hand: { ...opening.hand, forcedOpeningTileId: "6-6" as const } };
    expect(rejection(forced, 0, { type: "play", tileId: "1-2", end: "left" })).toBe("illegal-move");
    const next = apply(forced, 0, { type: "play", tileId: "6-6", end: "left" });
    expect(next.hand.forcedOpeningTileId).toBeNull();
  });
});

describe("draw rules", () => {
  it("forbids drawing while a move exists", () => {
    const state = buildMatch({ hands: [["6-1"], ["2-2"]], board: ["6-6"], stock: ["0-0"] });
    expect(rejection(state, 0, { type: "draw" })).toBe("cannot-draw");
    expect(rejection(state, 0, { type: "pass" })).toBe("cannot-pass");
  });

  it("a stuck seat draws, keeps the turn, and cannot pass while stock remains", () => {
    const state = buildMatch({ hands: [["1-2", "3-4"], ["2-2", "5-5"]], board: ["6-6"], stock: ["0-1", "6-0"] });
    expect(rejection(state, 0, { type: "pass" })).toBe("cannot-pass");
    const next = apply(state, 0, { type: "draw" });
    expect(next.hand.hands[0]?.map((x) => x.id)).toEqual(["1-2", "3-4", "0-1"]);
    expect(next.hand.stock.map((x) => x.id)).toEqual(["0-6"]);
    expect(next.hand.turn).toBe(0);
  });

  it("a stuck seat passes once the stock is empty", () => {
    const state = buildMatch({ hands: [["1-2"], ["6-5", "3-3"]], board: ["6-6"], stock: [] });
    const next = apply(state, 0, { type: "pass" });
    expect(next.hand.turn).toBe(1);
  });
});

describe("pass rules", () => {
  it("a stuck seat passes even with undealt tiles, and may never draw", () => {
    const state = buildMatch({ rules: ONE_VS_ONE_PASS, hands: [["1-2"], ["6-5"]], board: ["6-6"], stock: ["6-0"] });
    expect(computeAllowedActions(state, 0)).toEqual({ legalMoves: [], canDraw: false, canPass: true });
    expect(apply(state, 0, { type: "pass" }).hand.turn).toBe(1);
  });
});

describe("end of hand", () => {
  it("domino: the seat that empties its hand wins the pips left in the others", () => {
    const state = buildMatch({ hands: [["6-1"], ["5-4", "2-0"]], board: ["6-6"], stock: ["3-3"] });
    const end = apply(state, 0, { type: "play", tileId: "1-6", end: "right" });
    expect(end.hand.result).toEqual({ kind: "domino", winner: 0, points: 11, remainingPips: [0, 11], leaver: null });
    expect(end).toMatchObject({ phase: "finished", winner: 0, scores: [11, 0] });
  });

  it("blocked: lowest pip count wins once nobody can play or draw", () => {
    // After seat 0 plays 6-5 the ends are 6 | 5, and nobody holds a 5 or a 6.
    const state = buildMatch({ hands: [["6-5", "1-0"], ["4-3"]], board: ["6-6"], stock: [] });
    const end = apply(state, 0, { type: "play", tileId: "5-6", end: "right" });
    expect(end.hand.result).toEqual({ kind: "blocked", winner: 0, points: 7, remainingPips: [1, 7], leaver: null });
    expect(end.phase).toBe("finished");
  });

  it("blocked: a tie for lowest has no winner and scores nothing", () => {
    const state = buildMatch({ hands: [["6-5", "2-1"], ["3-0"]], board: ["6-6"], stock: [] });
    const end = apply(state, 0, { type: "play", tileId: "5-6", end: "right" });
    expect(end.hand.result).toMatchObject({ kind: "blocked", winner: null, points: 0 });
    expect(end).toMatchObject({ phase: "finished", winner: null, scores: [0, 0] });
  });

  it("is not blocked while a stuck seat can still draw", () => {
    const state = buildMatch({ hands: [["6-5", "1-0"], ["4-3"]], board: ["6-6"], stock: ["2-2"] });
    expect(apply(state, 0, { type: "play", tileId: "5-6", end: "right" }).phase).toBe("playing");
  });

  it("rejects game actions after the match ends", () => {
    const state = buildMatch({ hands: [["6-1"], ["5-4"]], board: ["6-6"] });
    const end = apply(state, 0, { type: "play", tileId: "1-6", end: "right" });
    expect(rejection(end, 1, { type: "play", tileId: "4-5", end: "left" })).toBe("not-playing");
    expect(rejection(end, 1, { type: "next-hand" })).toBe("not-hand-over");
  });
});

describe("points match", () => {
  const rules = {
    ...ONE_VS_ONE_DRAW,
    match: { kind: "points", target: 20, laterHandsOpener: "previous-winner" },
  } as const;

  it("a hand below target leads to hand-over, then next-hand deals with the winner opening freely", () => {
    const state = buildMatch({ rules, hands: [["6-1"], ["5-4"]], board: ["6-6"] });
    const over = apply(state, 0, { type: "play", tileId: "1-6", end: "right" });
    expect(over).toMatchObject({ phase: "hand-over", scores: [9, 0], winner: null });
    expect(rejection(over, 1, { type: "draw" })).toBe("not-playing");

    const next = apply(over, 1, { type: "next-hand" });
    expect(next).toMatchObject({ phase: "playing", handNumber: 2, scores: [9, 0] });
    expect(next.hand.turn).toBe(0);
    expect(next.hand.forcedOpeningTileId).toBeNull();
    expect(next.hand.board).toEqual([]);
  });

  it("reaching the target finishes the match", () => {
    const state = buildMatch({ rules, hands: [["6-1"], ["5-4"]], board: ["6-6"], scores: [15, 0] });
    expect(apply(state, 0, { type: "play", tileId: "1-6", end: "right" })).toMatchObject({
      phase: "finished",
      winner: 0,
      scores: [24, 0],
    });
  });
});

describe("forfeitMatch", () => {
  it("ends the match at once with the other seat as winner and no points", () => {
    const state = buildMatch({ hands: [["6-1", "2-2"], ["5-4"]], board: ["6-6"], scores: [3, 4] });
    const result = forfeitMatch(state, 1);
    if (!result.ok) throw new Error(result.error);
    expect(result.state).toMatchObject({ phase: "finished", winner: 0, scores: [3, 4], version: state.version + 1 });
    expect(result.state.hand.result).toEqual({ kind: "forfeit", winner: 0, points: 0, remainingPips: [11, 9], leaver: 1 });
  });

  it("works on either seat's turn and between hands, but not after the match ended", () => {
    const state = buildMatch({ hands: [["6-1"], ["5-4"]], board: ["6-6"], turn: 0 });
    expect(forfeitMatch(state, 0).ok).toBe(true);
    const between = { ...state, phase: "hand-over" as const };
    expect(forfeitMatch(between, 0).ok).toBe(true);
    const finished = { ...state, phase: "finished" as const };
    expect(forfeitMatch(finished, 0)).toEqual({ ok: false, error: "not-playing" });
  });

  it("with three or more players: the leaver loses and the fewest pips among the others wins, no points", () => {
    const three = { ...ONE_VS_ONE_DRAW, seatCount: 3, tilesPerPlayer: 5 };
    // Seat 0 leaves with the fewest pips (7) but cannot win; seat 2 (6 pips) beats seat 1 (9).
    const state = buildMatch({ rules: three, hands: [["6-1"], ["5-4"], ["3-3"]], board: ["6-6"] });
    const result = forfeitMatch(state, 0);
    if (!result.ok) throw new Error(result.error);
    expect(result.state).toMatchObject({ phase: "finished", winner: 2, scores: [0, 0, 0] });
    expect(result.state.hand.result).toEqual({ kind: "forfeit", winner: 2, points: 0, remainingPips: [7, 9, 6], leaver: 0 });
  });

  it("with three or more players: a tie for fewest pips among the others means nobody wins", () => {
    const four = { ...ONE_VS_ONE_DRAW, seatCount: 4, tilesPerPlayer: 5 };
    // Seat 3 leaves; seats 0 and 1 tie with 7 pips each.
    const state = buildMatch({ rules: four, hands: [["6-1"], ["5-2"], ["6-3"], ["5-6"]], board: ["0-0"] });
    const result = forfeitMatch(state, 3);
    if (!result.ok) throw new Error(result.error);
    expect(result.state).toMatchObject({ phase: "finished", winner: null });
    expect(result.state.hand.result).toMatchObject({ kind: "forfeit", winner: null, points: 0 });
  });

  it("rejects a seat that does not exist", () => {
    const state = buildMatch({ hands: [["6-1"], ["5-4"]], board: ["6-6"] });
    expect(() => forfeitMatch(state, 2)).toThrow(/out of range/);
  });
});

describe("openingIndex", () => {
  it("counts tiles played on the left of the opening tile", () => {
    const state = buildMatch({ hands: [["6-1", "6-2"], ["1-3", "2-4"]], board: ["6-6"] });
    const left = apply(state, 0, { type: "play", tileId: "1-6", end: "left" });
    expect(left.hand.openingIndex).toBe(1);
    const right = apply(left, 1, { type: "play", tileId: "1-3", end: "left" });
    expect(right.hand.openingIndex).toBe(2);
    expect(right.hand.board[right.hand.openingIndex]?.tile.id).toBe("6-6");
  });
});

describe("timeoutTurn", () => {
  it("passes the turn and counts a strike for the seat that ran out of time", () => {
    const state = buildMatch({ hands: [["6-1"], ["5-4"]], board: ["6-6"], turn: 0 });
    const result = timeoutTurn(state);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.hand.turn).toBe(1);
    expect(result.state.timeoutStrikes).toEqual([1, 0]);
    expect(result.state.version).toBe(state.version + 1);
    expect(result.state.phase).toBe("playing");
  });

  it("loses the match after the configured number of timeouts in a row", () => {
    const state = { ...buildMatch({ hands: [["6-1"], ["5-4"]], board: ["6-6"], turn: 0 }), timeoutStrikes: [1, 0] };
    const result = timeoutTurn(state);
    if (!result.ok) throw new Error(result.error);
    expect(result.state).toMatchObject({ phase: "finished", winner: 1, timeoutStrikes: [2, 0] });
    expect(result.state.hand.result).toMatchObject({ kind: "timeout", winner: 1, points: 0 });
  });

  it("acting resets the seat's count, so only timeouts in a row count", () => {
    const state = { ...buildMatch({ hands: [["6-1", "2-2"], ["5-4"]], board: ["6-6"], turn: 0 }), timeoutStrikes: [1, 0] };
    const played = apply(state, 0, { type: "play", tileId: "1-6", end: "right" });
    expect(played.timeoutStrikes).toEqual([0, 0]);
  });

  it("when the opener times out, the next seat opens with any tile", () => {
    const opening = buildMatch({ hands: [["6-6", "1-2"], ["3-4", "0-5"]] });
    const forced = { ...opening, hand: { ...opening.hand, forcedOpeningTileId: "6-6" as const } };
    const result = timeoutTurn(forced);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.hand.forcedOpeningTileId).toBeNull();
    expect(computeAllowedActions(result.state, 1).legalMoves).toHaveLength(2);
  });

  it("does nothing once the match is over", () => {
    const state = { ...buildMatch({ hands: [["6-1"], ["5-4"]], board: ["6-6"] }), phase: "finished" as const };
    expect(timeoutTurn(state)).toEqual({ ok: false, error: "not-playing" });
  });
});
