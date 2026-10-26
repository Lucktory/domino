import { createMatch } from "@dominio/engine";
import { DEMO_RULES_BY_MODE } from "@dominio/protocol";
import { describe, expect, it } from "vitest";
import { browserRng } from "../../lib/browser-rng.ts";
import { buildPracticeTable, HUMAN_SEAT } from "./practice-table.ts";

describe("buildPracticeTable", () => {
  it("shows the player only their own tiles, with no turn clock, for every mode", () => {
    for (const mode of ["1v1", "2v2", "3p", "4p"] as const) {
      const match = createMatch(DEMO_RULES_BY_MODE[mode], browserRng);
      const names = Array.from({ length: match.rules.seatCount }, (_, i) => `P${i}`);
      const { table, game } = buildPracticeTable(match, mode, names, 0);
      expect(table).toMatchObject({ mode, yourSeat: HUMAN_SEAT, turnDeadline: null, game });
      expect(table.seats.map((s) => s?.nickname)).toEqual(names);
      expect(game.hand).toEqual(match.hand.hands[HUMAN_SEAT]);
      expect(game.revealedHands).toBeNull();
      // The view carries counts for the other seats, never their tiles.
      expect(JSON.stringify(game)).not.toContain(JSON.stringify(match.hand.hands[1]));
    }
  });

  it("needs one name per seat", () => {
    const match = createMatch(DEMO_RULES_BY_MODE["1v1"], browserRng);
    expect(() => buildPracticeTable(match, "1v1", ["Ana"], 0)).toThrow(/needs 2 names/);
  });
});

describe("browserRng", () => {
  it("returns integers in range and reaches every value", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = browserRng.nextInt(7);
      expect(Number.isInteger(n) && n >= 0 && n < 7).toBe(true);
      seen.add(n);
    }
    expect(seen.size).toBe(7);
  });

  it("rejects bounds it cannot serve", () => {
    expect(() => browserRng.nextInt(0)).toThrow(/invalid bound/);
    expect(() => browserRng.nextInt(2.5)).toThrow(/invalid bound/);
  });
});
