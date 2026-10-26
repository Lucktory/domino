import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chooseBotAction } from "./bot.ts";
import { createMatch } from "./match.ts";
import type { RuleSet } from "./rules.ts";
import type { MatchState } from "./state.ts";
import { applyOrThrow, buildMatch, ONE_VS_ONE_DRAW, ONE_VS_ONE_PASS, PAIRS } from "./test-support/fixtures.ts";
import { createSeededRng } from "./test-support/rng.ts";
import { viewFor } from "./view.ts";

const botView = (state: MatchState) => viewFor(state, state.hand.turn);

describe("chooseBotAction", () => {
  it("plays a double before a heavier plain tile", () => {
    const state = buildMatch({ hands: [["6-5", "3-3"], ["1-2"]], board: ["6-3"] });
    expect(chooseBotAction(botView(state))).toMatchObject({ type: "play", tileId: "3-3" });
  });

  it("otherwise plays the heaviest playable tile", () => {
    const state = buildMatch({ hands: [["6-1", "6-5", "0-0"], ["1-2"]], board: ["6-6"] });
    expect(chooseBotAction(botView(state))).toMatchObject({ type: "play", tileId: "5-6" });
  });

  it("draws when nothing fits and the pile has tiles, passes when it is empty", () => {
    const stuck = buildMatch({ hands: [["1-2"], ["3-4"]], board: ["6-6"], stock: ["0-0"] });
    expect(chooseBotAction(botView(stuck))).toEqual({ type: "draw" });
    const empty = buildMatch({ rules: ONE_VS_ONE_PASS, hands: [["1-2"], ["3-4", "6-0"]], board: ["6-6"] });
    expect(chooseBotAction(botView(empty))).toEqual({ type: "pass" });
  });

  it("refuses to move out of turn", () => {
    const state = buildMatch({ hands: [["6-1"], ["5-4"]], board: ["6-6"], turn: 0 });
    expect(() => chooseBotAction(viewFor(state, 1))).toThrow(/not its turn/);
  });
});

describe("computer-only games", () => {
  const three: RuleSet = { ...ONE_VS_ONE_DRAW, seatCount: 3, tilesPerPlayer: 5 };
  const four: RuleSet = { ...ONE_VS_ONE_DRAW, seatCount: 4, tilesPerPlayer: 5 };

  it("every move the bot picks is accepted, and the game always finishes", () => {
    fc.assert(
      fc.property(fc.constantFrom(ONE_VS_ONE_DRAW, ONE_VS_ONE_PASS, PAIRS, three, four), fc.integer(), (rules, seed) => {
        const rng = createSeededRng(seed);
        let state = createMatch(rules, rng);
        for (let steps = 0; state.phase === "playing"; steps++) {
          if (steps > 500) throw new Error("game did not finish");
          state = applyOrThrow(state, state.hand.turn, chooseBotAction(botView(state)), rng);
        }
        expect(state.phase).toBe("finished");
        expect(state.hand.result).not.toBeNull();
      }),
      { numRuns: 300 },
    );
  });
});
