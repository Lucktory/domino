import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getAt } from "./indexing.ts";
import { applyAction, computeAllowedActions, createMatch, timeoutTurn } from "./match.ts";
import { countSides, deriveSide, type RuleSet } from "./rules.ts";
import type { Action, MatchState } from "./state.ts";
import { createSeededRng } from "./test-support/rng.ts";
import { createDoubleSixSet } from "./tiles.ts";

const ALL_TILE_IDS = createDoubleSixSet()
  .map((tile) => tile.id)
  .sort();

/** Hands + stock + board always hold the full set, each tile exactly once. */
function allTileIds(state: MatchState): string[] {
  const { hand } = state;
  return [...hand.hands.flat(), ...hand.stock, ...hand.board.map((p) => p.tile)].map((tile) => tile.id).sort();
}

function allowedActionsOf(state: MatchState): Action[] {
  if (state.phase === "hand-over") return [{ type: "next-hand" }];
  const allowed = computeAllowedActions(state, state.hand.turn);
  return [
    ...allowed.legalMoves.map((m): Action => ({ type: "play", ...m })),
    ...(allowed.canDraw ? [{ type: "draw" } as const] : []),
    ...(allowed.canPass ? [{ type: "pass" } as const] : []),
  ];
}

const anyRulesArb = fc.record({
  seatCount: fc.constantFrom(2, 3, 4),
  teams: fc.constantFrom("none" as const, "pairs" as const),
  tilesPerPlayer: fc.constant(7),
  whenNoMove: fc.constantFrom("draw" as const, "pass" as const),
  opening: fc.constantFrom("highest-double" as const, "random-seat" as const),
  match: fc.oneof(
    fc.constant({ kind: "single-hand" as const }),
    fc.record({
      kind: fc.constant("points" as const),
      target: fc.integer({ min: 1, max: 150 }),
      laterHandsOpener: fc.constantFrom("previous-winner" as const, "opening-rule" as const),
    }),
  ),
  turnSeconds: fc.constant(15),
  timeoutStrikesToForfeit: fc.integer({ min: 1, max: 3 }),
});

/** Valid rule sets only: pairs always has 4 seats and never opens later hands by previous winner. */
const rulesArb: fc.Arbitrary<RuleSet> = anyRulesArb.map((rules): RuleSet => {
  if (rules.teams === "none") return rules;
  const match = rules.match.kind === "points" ? { ...rules.match, laterHandsOpener: "opening-rule" as const } : rules.match;
  return { ...rules, seatCount: 4, match };
});

describe("random full matches", () => {
  it("keep every invariant from deal to finish", () => {
    fc.assert(
      fc.property(rulesArb, fc.integer(), (rules, seed) => {
        const rng = createSeededRng(seed);
        let state = createMatch(rules, rng);
        let steps = 0;
        let opening: string | null = null;

        while (state.phase !== "finished") {
          expect(allTileIds(state)).toEqual(ALL_TILE_IDS);
          // The opening tile never moves: openingIndex always points at it.
          if (state.hand.board.length > 0) {
            expect(state.hand.openingIndex).toBeLessThan(state.hand.board.length);
            if (opening === null) opening = getAt(state.hand.board, state.hand.openingIndex).tile.id;
            expect(getAt(state.hand.board, state.hand.openingIndex).tile.id).toBe(opening);
          } else {
            opening = null;
          }
          const actions = allowedActionsOf(state);
          expect(actions.length).toBeGreaterThan(0);

          // Seats other than the current one may do nothing.
          for (let seat = 0; seat < rules.seatCount; seat++) {
            if (seat !== state.hand.turn && state.phase === "playing") {
              const rejected = applyAction(state, seat, { type: "pass" }, rng);
              expect(rejected).toEqual({ ok: false, error: "not-your-turn" });
            }
          }

          // Now and then the player to move runs out of time.
          const seat = state.hand.turn;
          if (state.phase === "playing" && rng.nextInt(8) === 0) {
            const timedOut = timeoutTurn(state);
            if (!timedOut.ok) throw new Error(`timeout rejected: ${timedOut.error}`);
            expect(timedOut.state.version).toBe(state.version + 1);
            if (timedOut.state.phase === "finished") {
              const result = timedOut.state.hand.result;
              expect(result).toMatchObject({ kind: "timeout", points: 0 });
              // The side that ran out of time never wins.
              expect(result?.winner).not.toBe(deriveSide(rules, seat));
              if (countSides(rules) === 2) expect(result?.winner).toBe(1 - deriveSide(rules, seat));
              expect(getAt(timedOut.state.timeoutStrikes, seat)).toBe(rules.timeoutStrikesToForfeit);
            } else {
              expect(timedOut.state.hand.turn).toBe((seat + 1) % rules.seatCount);
            }
            state = timedOut.state;
            steps++;
            continue;
          }

          const action = getAt(actions, rng.nextInt(actions.length));
          const result = applyAction(state, seat, action, rng);
          if (!result.ok) throw new Error(`allowed action rejected: ${result.error}`);
          expect(result.state.version).toBe(state.version + 1);
          if (action.type !== "next-hand") expect(getAt(result.state.timeoutStrikes, seat)).toBe(0);
          state = result.state;

          steps++;
          if (steps > 5000) throw new Error("match did not terminate");
        }

        expect(allTileIds(state)).toEqual(ALL_TILE_IDS);
        const ending = state.hand.result;
        if (ending === null) throw new Error("finished match without a result");
        if (ending.kind === "timeout" || ending.kind === "forfeit") {
          // Lost by abandoning or by time: the other side wins whatever the score.
          expect(state.winner).toBe(ending.winner);
          expect(ending.points).toBe(0);
        } else if (rules.match.kind === "points" && state.winner !== null) {
          expect(state.scores[state.winner]).toBeGreaterThanOrEqual(rules.match.target);
        }
        expect(state.scores).toHaveLength(countSides(rules));
      }),
      { numRuns: 300 },
    );
  });
});
