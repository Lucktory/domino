import { describe, expect, it } from "vitest";
import { createMatch, forfeitMatch, timeoutTurn } from "./match.ts";
import { countSides, deriveSide } from "./rules.ts";
import type { Action, MatchState } from "./state.ts";
import { applyOrThrow, buildMatch, PAIRS } from "./test-support/fixtures.ts";
import { createSeededRng } from "./test-support/rng.ts";

const rng = createSeededRng(7);

const apply = (state: MatchState, seat: number, action: Action) => applyOrThrow(state, seat, action, rng);

describe("pairs: sides", () => {
  it("partners sit opposite: seats 0 + 2 are side 0, seats 1 + 3 are side 1", () => {
    expect([0, 1, 2, 3].map((seat) => deriveSide(PAIRS, seat))).toEqual([0, 1, 0, 1]);
    expect(countSides(PAIRS)).toBe(2);
  });

  it("needs exactly 4 seats, and a team has no single seat to open the next hand", () => {
    expect(() => createMatch({ ...PAIRS, seatCount: 2 }, rng)).toThrow(/pairs needs seatCount 4/);
    const points = { kind: "points", target: 100, laterHandsOpener: "previous-winner" } as const;
    expect(() => createMatch({ ...PAIRS, match: points }, rng)).toThrow(/previous-winner/);
  });

  it("deals every tile (no pile), keeps one score per team, and the double six opens", () => {
    const match = createMatch(PAIRS, rng);
    expect(match.hand.hands.map((tiles) => tiles.length)).toEqual([7, 7, 7, 7]);
    expect(match.hand.stock).toHaveLength(0);
    expect(match.scores).toEqual([0, 0]);
    expect(match.hand.forcedOpeningTileId).toBe("6-6");
    expect(match.hand.hands[match.hand.turn]?.some((tile) => tile.id === "6-6")).toBe(true);
  });
});

describe("pairs: domino", () => {
  it("the player's team wins and scores only the rivals' pips", () => {
    // Seat 2 plays its last tile. Rivals hold 5-5 (10) and 4-4 + 0-2 (10); the partner's 7 pips do not count.
    const state = buildMatch({ rules: PAIRS, hands: [["1-1", "2-3"], ["5-5"], ["6-1"], ["4-4", "0-2"]], board: ["6-6"], turn: 2 });
    const done = apply(state, 2, { type: "play", tileId: "1-6", end: "right" });
    expect(done.hand.result).toEqual({ kind: "domino", winner: 0, points: 20, remainingPips: [7, 10, 0, 10], leaver: null });
    expect(done).toMatchObject({ phase: "finished", winner: 0, scores: [20, 0] });
  });
});

describe("pairs: tranque", () => {
  it("compares team totals, not single players", () => {
    // Seat 0 alone has the fewest pips (0), but its team holds 0 + 10 against the rivals' 3 + 2.
    const state = buildMatch({ rules: PAIRS, hands: [["0-0"], ["1-2"], ["5-5"], ["1-1"]], board: ["6-6"], turn: 0 });
    const done = apply(state, 0, { type: "pass" });
    expect(done.hand.result).toEqual({ kind: "blocked", winner: 1, points: 10, remainingPips: [0, 3, 10, 2], leaver: null });
    expect(done.scores).toEqual([0, 10]);
  });

  it("equal team totals is a tie: nobody scores", () => {
    const state = buildMatch({ rules: PAIRS, hands: [["1-2"], ["0-3"], ["2-2"], ["0-4"]], board: ["6-6"], turn: 0 });
    const done = apply(state, 0, { type: "pass" });
    expect(done.hand.result).toMatchObject({ kind: "blocked", winner: null, points: 0 });
    expect(done).toMatchObject({ phase: "finished", winner: null, scores: [0, 0] });
  });
});

describe("pairs: leaving and running out of time", () => {
  const state = buildMatch({ rules: PAIRS, hands: [["1-1"], ["5-5"], ["2-3"], ["4-4"]], board: ["6-6"], turn: 1 });

  it("a player who leaves loses the match for the whole team", () => {
    const leftBy3 = forfeitMatch(state, 3);
    if (!leftBy3.ok) throw new Error(leftBy3.error);
    expect(leftBy3.state).toMatchObject({ phase: "finished", winner: 0 });
    expect(leftBy3.state.hand.result).toMatchObject({ kind: "forfeit", winner: 0, points: 0 });
    const leftBy2 = forfeitMatch(state, 2);
    if (!leftBy2.ok) throw new Error(leftBy2.error);
    expect(leftBy2.state.winner).toBe(1);
  });

  it("a timeout passes to the next seat; too many in a row lose it for the team", () => {
    const first = timeoutTurn(state);
    if (!first.ok) throw new Error(first.error);
    expect(first.state.hand.turn).toBe(2);
    expect(first.state.timeoutStrikes).toEqual([0, 1, 0, 0]);

    const again = timeoutTurn({ ...state, timeoutStrikes: [0, 1, 0, 0] });
    if (!again.ok) throw new Error(again.error);
    expect(again.state).toMatchObject({ phase: "finished", winner: 0 });
    expect(again.state.hand.result).toMatchObject({ kind: "timeout", winner: 0, points: 0 });
  });
});
