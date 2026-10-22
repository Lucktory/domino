import type { PlayerView } from "@dominio/engine";
import type { TableView } from "@dominio/protocol";
import { describe, expect, it } from "vitest";
import { adoptTable, applyTableUpdate } from "./table-sync.ts";

function gameAt(version: number): PlayerView {
  return {
    seat: 0,
    rules: { seatCount: 2, teams: "none", tilesPerPlayer: 7, whenNoMove: "draw", opening: "highest-double", match: { kind: "single-hand" }, turnSeconds: 15, timeoutStrikesToForfeit: 2 },
    version,
    handNumber: 1,
    phase: "playing",
    turn: 0,
    hand: [],
    tileCounts: [7, 7],
    stockCount: 14,
    board: [],
    openingIndex: 0,
    legalMoves: [],
    canDraw: false,
    canPass: false,
    scores: [0, 0],
    timeoutStrikes: [0, 0],
    handResult: null,
    revealedHands: null,
    matchWinner: null,
  };
}

function view(tableId: string, version: number | null, connected = true): TableView {
  return {
    tableId,
    code: "ABCDEF",
    visibility: "public",
    mode: "1v1",
    yourSeat: 0,
    seats: [{ nickname: "Ana", connected }, null],
    game: version === null ? null : gameAt(version),
    turnDeadline: null,
    serverNow: 0,
  };
}

describe("applyTableUpdate", () => {
  it("never adopts a table from a broadcast when none is shown", () => {
    expect(applyTableUpdate(null, view("t1", 3))).toBeNull();
  });

  it("ignores other tables", () => {
    const current = view("t1", 3);
    expect(applyTableUpdate(current, view("t2", 9))).toBe(current);
  });

  it("ignores older versions and a waiting-room view after play started", () => {
    const current = view("t1", 5);
    expect(applyTableUpdate(current, view("t1", 4))).toBe(current);
    expect(applyTableUpdate(current, view("t1", null))).toBe(current);
  });

  it("accepts newer versions, the match starting, and same-version presence changes", () => {
    const current = view("t1", 5);
    const newer = view("t1", 6);
    expect(applyTableUpdate(current, newer)).toBe(newer);
    const presence = view("t1", 5, false);
    expect(applyTableUpdate(current, presence)).toBe(presence);
    const started = view("t1", 1);
    expect(applyTableUpdate(view("t1", null), started)).toBe(started);
  });
});

describe("adoptTable", () => {
  it("switches to the replied table", () => {
    const reply = view("t2", null);
    expect(adoptTable(null, reply)).toBe(reply);
    expect(adoptTable(view("t1", 4), reply)).toBe(reply);
  });

  it("keeps a newer state of the same table that arrived before the reply", () => {
    const newer = view("t1", 2);
    expect(adoptTable(newer, view("t1", null))).toBe(newer);
  });
});
