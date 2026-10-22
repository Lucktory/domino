import { describe, expect, it } from "vitest";
import { computeLegalMoves, getBoardEnds, placeTile } from "./board.ts";
import { boardOf, t } from "./test-support/fixtures.ts";

describe("computeLegalMoves", () => {
  it("allows any tile on an empty board", () => {
    expect(computeLegalMoves([t("1-2"), t("3-4")], [], null)).toEqual([
      { tileId: "1-2", end: "left" },
      { tileId: "3-4", end: "left" },
    ]);
  });

  it("allows only the forced opening tile when one is set", () => {
    expect(computeLegalMoves([t("1-2"), t("6-6")], [], "6-6")).toEqual([{ tileId: "6-6", end: "left" }]);
  });

  it("lists each end a tile fits", () => {
    const board = boardOf(["6-6", "6-3"]); // ends: 6 | 3
    expect(computeLegalMoves([t("3-6"), t("2-3"), t("1-1")], board, null)).toEqual([
      { tileId: "3-6", end: "left" },
      { tileId: "3-6", end: "right" },
      { tileId: "2-3", end: "right" },
    ]);
  });
});

describe("placeTile", () => {
  it("orients a tile so the matching pip touches the chain", () => {
    const board = boardOf(["6-6", "6-3"]);
    const onRight = placeTile(board, t("2-3"), "right");
    expect(getBoardEnds(onRight)).toEqual({ left: 6, right: 2 });
    const onLeft = placeTile(board, t("4-6"), "left");
    expect(onLeft[0]).toMatchObject({ left: 4, right: 6 });
    expect(getBoardEnds(onLeft)).toEqual({ left: 4, right: 3 });
  });

  it("does not modify the original board", () => {
    const board = boardOf(["6-6"]);
    placeTile(board, t("6-1"), "right");
    expect(board).toHaveLength(1);
  });
});
