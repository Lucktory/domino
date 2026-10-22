import { describe, expect, it } from "vitest";
import { dealHand } from "./deal.ts";
import { createRngForOrder } from "./test-support/rng.ts";
import { ONE_VS_ONE_DRAW, t } from "./test-support/fixtures.ts";
import { createDoubleSixSet } from "./tiles.ts";

const SET = createDoubleSixSet();

/** Deal where the given tiles come first, rest in set order. */
function orderStartingWith(ids: string[]) {
  const first = ids.map((id) => SET.find((tile) => tile.id === t(id).id) ?? fail(id));
  return [...first, ...SET.filter((tile) => !first.includes(tile))];
}

function fail(id: string): never {
  throw new Error(`no tile ${id}`);
}

describe("dealHand", () => {
  it("deals tilesPerPlayer to each seat and leaves the rest as stock", () => {
    const order = orderStartingWith([]);
    const hand = dealHand(ONE_VS_ONE_DRAW, createRngForOrder(SET, order), null);
    expect(hand.hands.map((h) => h.length)).toEqual([7, 7]);
    expect(hand.stock).toHaveLength(14);
  });

  it("highest-double: holder of the highest dealt double opens and must play it", () => {
    // seat 0: 0-1..0-6 + 1-2 ; seat 1 holds 5-5 and 2-2
    const order = orderStartingWith(["0-1", "0-2", "0-3", "0-4", "0-5", "0-6", "1-2", "5-5", "2-2", "1-3", "1-4", "1-5", "1-6", "2-3"]);
    const hand = dealHand(ONE_VS_ONE_DRAW, createRngForOrder(SET, order), null);
    expect(hand.turn).toBe(1);
    expect(hand.forcedOpeningTileId).toBe("5-5");
  });

  it("highest-double: with no double dealt, holder of the heaviest tile opens with it", () => {
    const order = orderStartingWith(["0-1", "0-2", "0-3", "0-4", "0-5", "0-6", "1-2", "1-3", "1-4", "1-5", "1-6", "2-3", "2-4", "4-6"]);
    const hand = dealHand(ONE_VS_ONE_DRAW, createRngForOrder(SET, order), null);
    expect(hand.turn).toBe(1);
    expect(hand.forcedOpeningTileId).toBe("4-6");
  });

  it("random-seat: the rng picks the opener and no tile is forced", () => {
    const rules = { ...ONE_VS_ONE_DRAW, opening: "random-seat" as const };
    const hand = dealHand(rules, createRngForOrder(SET, SET, [1]), null);
    expect(hand.turn).toBe(1);
    expect(hand.forcedOpeningTileId).toBeNull();
  });

  it("an explicit opener plays any tile", () => {
    const hand = dealHand(ONE_VS_ONE_DRAW, createRngForOrder(SET, SET), 0);
    expect(hand.turn).toBe(0);
    expect(hand.forcedOpeningTileId).toBeNull();
  });
});
