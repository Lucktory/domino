import { describe, expect, it } from "vitest";
import { applyAction } from "./match.ts";
import { buildMatch } from "./test-support/fixtures.ts";
import { createSeededRng } from "./test-support/rng.ts";
import { viewFor } from "./view.ts";

describe("viewFor", () => {
  const state = buildMatch({ hands: [["6-1", "2-2"], ["5-4", "3-0", "1-1"]], board: ["6-6"], stock: ["4-4", "0-0"] });

  it("shows a seat its own tiles and only counts for everyone else", () => {
    const view = viewFor(state, 1);
    expect(view.hand.map((x) => x.id)).toEqual(["4-5", "0-3", "1-1"]);
    expect(view.tileCounts).toEqual([2, 3]);
    expect(view.stockCount).toBe(2);
    expect(view.revealedHands).toBeNull();
  });

  it("never serializes another seat's tiles or the stock while the hand is in play", () => {
    const json = JSON.stringify(viewFor(state, 1));
    for (const hidden of ["1-6", "2-2", "4-4", "0-0"]) expect(json).not.toContain(`"${hidden}"`);
  });

  it("offers moves only to the seat whose turn it is", () => {
    expect(viewFor(state, 0).legalMoves).toEqual([{ tileId: "1-6", end: "left" }, { tileId: "1-6", end: "right" }]);
    expect(viewFor(state, 1).legalMoves).toEqual([]);
  });

  it("reveals every hand once the hand is over", () => {
    const result = applyAction(
      buildMatch({ hands: [["6-1"], ["5-4"]], board: ["6-6"] }),
      0,
      { type: "play", tileId: "1-6", end: "right" },
      createSeededRng(1),
    );
    if (!result.ok) throw new Error(result.error);
    expect(viewFor(result.state, 0).revealedHands?.map((h) => h.map((x) => x.id))).toEqual([[], ["4-5"]]);
  });
});
