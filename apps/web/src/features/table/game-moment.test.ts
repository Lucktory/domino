import type { HandResult, PlayerView } from "@dominio/engine";
import { describe, expect, it } from "vitest";
import { deriveOutcome, deriveTurnMoment, isMyMoment } from "./game-moment.ts";

const tile = (low: number, high: number) => ({ id: `${low}-${high}` as const, low, high });

function view(overrides: Partial<PlayerView>): PlayerView {
  return {
    seat: 0,
    rules: { seatCount: 2, teams: "none", tilesPerPlayer: 7, whenNoMove: "draw", opening: "highest-double", match: { kind: "single-hand" }, turnSeconds: 15, timeoutStrikesToForfeit: 2 },
    version: 3,
    handNumber: 1,
    phase: "playing",
    turn: 0,
    hand: [tile(1, 2), tile(3, 4)],
    tileCounts: [2, 5],
    stockCount: 10,
    board: [{ tile: tile(6, 6), left: 6, right: 6 }],
    openingIndex: 0,
    legalMoves: [{ tileId: "1-2", end: "left" }],
    canDraw: false,
    canPass: false,
    scores: [0, 0],
    timeoutStrikes: [0, 0],
    handResult: null,
    revealedHands: null,
    matchWinner: null,
    ...overrides,
  };
}

function finished(result: HandResult, seat = 0): PlayerView {
  return view({ seat, phase: "finished", handResult: result, revealedHands: [[], []], matchWinner: result.winner });
}

describe("deriveOutcome", () => {
  it("is null while the hand is in play", () => {
    expect(deriveOutcome(view({}))).toBeNull();
  });

  it("tells victory and defeat apart by seat, with the reason and points", () => {
    const result: HandResult = { kind: "domino", winner: 1, points: 12, remainingPips: [12, 0], leaver: null };
    expect(deriveOutcome(finished(result, 1))).toEqual({ kind: "win", reason: "domino", points: 12, leaver: null });
    expect(deriveOutcome(finished(result, 0))).toEqual({ kind: "loss", reason: "domino", winnerSide: 1, points: 12, leaver: null });
  });

  it("in pairs a win belongs to the whole team: a partner's domino is my win too", () => {
    const pairs = { ...view({}).rules, seatCount: 4, teams: "pairs" as const, whenNoMove: "pass" as const };
    const result: HandResult = { kind: "domino", winner: 0, points: 20, remainingPips: [7, 10, 0, 10], leaver: null };
    const at = (seat: number) => view({ seat, rules: pairs, phase: "finished", handResult: result, revealedHands: [[], [], [], []], matchWinner: 0 });
    expect(deriveOutcome(at(0))).toMatchObject({ kind: "win", reason: "domino", points: 20 });
    expect(deriveOutcome(at(2))).toMatchObject({ kind: "win", reason: "domino", points: 20 });
    expect(deriveOutcome(at(1))).toMatchObject({ kind: "loss", reason: "domino", winnerSide: 0, points: 20 });
    expect(deriveOutcome(at(3))).toMatchObject({ kind: "loss", reason: "domino", winnerSide: 0, points: 20 });
  });

  it("reports a tie when a blocked hand has no winner, and a forfeit win", () => {
    expect(deriveOutcome(finished({ kind: "blocked", winner: null, points: 0, remainingPips: [5, 5], leaver: null }))).toEqual({
      kind: "tie",
      reason: "blocked",
      leaver: null,
    });
    expect(deriveOutcome(finished({ kind: "forfeit", winner: 0, points: 0, remainingPips: [9, 9], leaver: 1 }))).toMatchObject({
      kind: "win",
      reason: "forfeit",
    });
  });
});

describe("deriveOutcome: three or four players", () => {
  const three = { ...view({}).rules, seatCount: 3, tilesPerPlayer: 5 };
  const at = (seat: number, result: HandResult) =>
    view({ seat, rules: three, phase: "finished", handResult: result, revealedHands: [[], [], []], matchWinner: result.winner });

  it("whoever left lost, even when the others tie; the others see a tie", () => {
    const result: HandResult = { kind: "forfeit", winner: null, points: 0, remainingPips: [7, 7, 9], leaver: 2 };
    expect(deriveOutcome(at(2, result))).toEqual({ kind: "loss", reason: "forfeit", winnerSide: null, points: 0, leaver: 2 });
    expect(deriveOutcome(at(0, result))).toEqual({ kind: "tie", reason: "forfeit", leaver: 2 });
  });

  it("a player who did not leave loses to the fewest-pips player, and knows who left", () => {
    const result: HandResult = { kind: "timeout", winner: 1, points: 0, remainingPips: [9, 4, 7], leaver: 2 };
    expect(deriveOutcome(at(1, result))).toMatchObject({ kind: "win", leaver: 2 });
    expect(deriveOutcome(at(0, result))).toEqual({ kind: "loss", reason: "timeout", winnerSide: 1, points: 0, leaver: 2 });
  });
});

describe("deriveTurnMoment", () => {
  it("covers every moment of a turn", () => {
    expect(deriveTurnMoment(view({ turn: 1, legalMoves: [] }), false)).toBe("their-turn");
    expect(deriveTurnMoment(view({ phase: "finished" }), false)).toBe("hand-over");
    expect(deriveTurnMoment(view({}), false)).toBe("play");
    expect(deriveTurnMoment(view({}), true)).toBe("choose-end");
    expect(deriveTurnMoment(view({ legalMoves: [], canDraw: true }), false)).toBe("must-draw");
    expect(deriveTurnMoment(view({ legalMoves: [], canPass: true, stockCount: 0 }), false)).toBe("must-pass");
    expect(deriveTurnMoment(view({ board: [] }), false)).toBe("opening");
  });

  it("an empty board with every tile playable is a normal turn, not a forced opening", () => {
    const free = view({ board: [], legalMoves: [{ tileId: "1-2", end: "left" }, { tileId: "3-4", end: "left" }] });
    expect(deriveTurnMoment(free, false)).toBe("play");
  });

  it("knows which moments are the player's own", () => {
    expect(isMyMoment("must-draw")).toBe(true);
    expect(isMyMoment("their-turn")).toBe(false);
    expect(isMyMoment("hand-over")).toBe(false);
  });
});
