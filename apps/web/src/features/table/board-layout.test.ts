import type { PlacedTile } from "@dominio/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeBoardLayout, computeView, TABLE, type Rect } from "./board-layout.ts";

function placed(left: number, right: number): PlacedTile {
  const low = Math.min(left, right);
  const high = Math.max(left, right);
  return { tile: { id: `${low}-${high}`, low, high }, left, right };
}

/** A consistent chain left to right: each tile's left pip equals the previous tile's right pip. */
function chain(pips: number[]): PlacedTile[] {
  return pips.slice(1).map((pip, i) => placed(pips[i] ?? 0, pip));
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
}

/** End badges are drawn as circles of this radius (in table units) around their anchor. */
const BADGE_RADIUS = 0.45;

function expectInsideTable(r: Rect): void {
  expect(r.x).toBeGreaterThanOrEqual(TABLE.x);
  expect(r.y).toBeGreaterThanOrEqual(TABLE.y);
  expect(r.x + r.w).toBeLessThanOrEqual(TABLE.x + TABLE.w);
  expect(r.y + r.h).toBeLessThanOrEqual(TABLE.y + TABLE.h);
}

function expectValidLayout(board: PlacedTile[], openingIndex: number): void {
  const layout = computeBoardLayout(board, openingIndex);
  expect(layout.tiles).toHaveLength(board.length);
  const all: Rect[] = [...layout.tiles, layout.slots.left, layout.slots.right];
  for (const [i, a] of all.entries()) {
    expectInsideTable(a);
    for (const b of all.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
  }
  for (const badge of Object.values(layout.ends ?? {})) {
    const r = BADGE_RADIUS;
    expectInsideTable({ x: badge.x - r, y: badge.y - r, w: 2 * r, h: 2 * r });
  }
}

describe("computeBoardLayout", () => {
  it("centers the opening tile", () => {
    const layout = computeBoardLayout([placed(6, 6)], 0);
    expect(layout.tiles).toEqual([expect.objectContaining({ x: -0.5, y: -1, w: 1, h: 2, vertical: true, end: null })]);
    expect(layout.slots.left.x + layout.slots.left.w).toBeLessThanOrEqual(-0.5);
    expect(layout.slots.right.x).toBeGreaterThanOrEqual(0.5);
  });

  it("draws touching pips side by side on a straight row", () => {
    const layout = computeBoardLayout(chain([3, 6, 6, 2]), 1); // 3|6, 6|6, 6|2
    const [opening, right, left] = layout.tiles;
    expect(opening?.placed.tile.id).toBe("6-6");
    expect(right).toMatchObject({ first: 6, second: 2, end: "right" });
    expect(left).toMatchObject({ first: 3, second: 6, end: "left" });
  });

  it("keeps existing tiles in place when a tile is added on the left", () => {
    const before = computeBoardLayout(chain([6, 6, 2]), 0);
    const after = computeBoardLayout(chain([4, 6, 6, 2]), 1);
    const pos = (l: typeof before, id: string) => l.tiles.find((t) => t.placed.tile.id === id);
    expect(pos(after, "6-6")).toMatchObject({ x: pos(before, "6-6")?.x, y: pos(before, "6-6")?.y });
    expect(pos(after, "2-6")).toMatchObject({ x: pos(before, "2-6")?.x, y: pos(before, "2-6")?.y });
  });

  it("is the same picture for everyone: it depends only on the board", () => {
    const board = chain([0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1]);
    expect(computeBoardLayout(board, 5)).toEqual(computeBoardLayout(board, 5));
  });
});

describe("corners and end numbers", () => {
  const board = chain([0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0]);
  const layout = computeBoardLayout(board, 0);

  it("turns with an upright tile under the end of the row, and the next row lines up with its far half", () => {
    const cornerIndex = layout.tiles.findIndex((t) => t.corner);
    const corner = layout.tiles[cornerIndex];
    const before = layout.tiles[cornerIndex - 1];
    const after = layout.tiles[cornerIndex + 1];
    if (corner === undefined || before === undefined || after === undefined) throw new Error("no corner found");
    expect(corner).toMatchObject({ vertical: true, w: 1, h: 2 });
    expect(corner.x + corner.w).toBeCloseTo(before.x + before.w, 9);
    expect(corner.y).toBeGreaterThan(before.y + before.h - 1e-9);
    expect(corner.first).toBe(corner.placed.left);
    expect(after.x + after.w).toBeLessThanOrEqual(corner.x + 1e-9);
    expect(after.y + after.h / 2).toBeCloseTo(corner.y + corner.h * 0.75, 9);
  });

  it("turns the right branch down and the left branch up", () => {
    const right = computeBoardLayout(board, 0).tiles.slice(1);
    const left = computeBoardLayout(board, board.length - 1).tiles.slice(1);
    expect(Math.max(...right.map((t) => t.y))).toBeGreaterThan(0);
    expect(Math.min(...left.map((t) => t.y))).toBeLessThan(0);
  });

  it("reports the open number at each end", () => {
    expect(layout.ends).toMatchObject({ left: { pip: 0 }, right: { pip: 0 } });
    expect(computeBoardLayout(chain([3, 6, 6, 2]), 1).ends).toMatchObject({ left: { pip: 3 }, right: { pip: 2 } });
    // Each badge sits just outside the end tile (a 2-wide tile spans -1..1), clear of its pips.
    const single = computeBoardLayout([placed(5, 2)], 0).ends;
    expect(single).toMatchObject({ left: { pip: 5 }, right: { pip: 2 } });
    expect(single?.left.x).toBeCloseTo(-1 - BADGE_RADIUS, 9);
    expect(single?.right.x).toBeCloseTo(1 + BADGE_RADIUS, 9);
    expect(computeBoardLayout([], 0).ends).toBeNull();
  });
});

describe("the fixed table", () => {
  it("holds the longest chains when every tile goes down one branch", () => {
    // 28 tiles, none doubles (most rows), all on one side of the opening, either side.
    const pips = Array.from({ length: 29 }, (_, i) => i % 6);
    expectValidLayout(chain(pips), 0);
    expectValidLayout(chain(pips), 27);
    const withDoubles = Array.from({ length: 29 }, (_, i) => (i % 3 === 0 ? 6 : i % 7));
    expectValidLayout(chain(withDoubles), 0);
    expectValidLayout(chain(withDoubles), 27);
  });

  it("holds any chain of up to 28 tiles with any opening, without overlaps", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 2, maxLength: 29 }), fc.nat(), (pips, seed) => {
        const board = chain(pips);
        expectValidLayout(board, seed % board.length);
      }),
      { numRuns: 1000 },
    );
  });
});

describe("computeView (zoom steps)", () => {
  const inside = (r: Rect, v: Rect) => r.x >= v.x && r.y >= v.y && r.x + r.w <= v.x + v.w && r.y + r.h <= v.y + v.h;

  it("starts close on a short chain: the first tile is big", () => {
    const view = computeView(computeBoardLayout([placed(6, 6)], 0));
    expect(view.w).toBeCloseTo(TABLE.w * 0.4, 9);
  });

  it("follows a chain that grows to one side instead of stepping out early", () => {
    const view = computeView(computeBoardLayout(chain([2, 2, 6, 3]), 0)); // 2|2 opening, then two to the right
    expect(view.w).toBeCloseTo(TABLE.w * 0.4, 9);
    expect(view.x + view.w / 2).toBeGreaterThan(0);
  });

  it("stays inside the table", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 2, maxLength: 29 }), fc.nat(), (pips, seed) => {
        const board = chain(pips);
        const view = computeView(computeBoardLayout(board, seed % board.length));
        expect(inside(view, TABLE)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("always holds every tile and slot, and only steps out as the chain grows", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 2, maxLength: 29 }), fc.array(fc.boolean(), { minLength: 28, maxLength: 28 }), (pips, sides) => {
        // Grow a chain tile by tile, adding to the left or right end, like a real hand.
        const full = chain(pips);
        const start = Math.floor(full.length / 2);
        let lo = start;
        let hi = start;
        let previousWidth = 0;
        for (let i = 0; lo > 0 || hi < full.length - 1; i++) {
          const goLeft = (sides[i % sides.length] ?? false) ? lo > 0 : hi === full.length - 1;
          if (goLeft) lo--;
          else hi++;
          const layout = computeBoardLayout(full.slice(lo, hi + 1), start - lo);
          const view = computeView(layout);
          for (const r of [...layout.tiles, layout.slots.left, layout.slots.right]) expect(inside(r, view)).toBe(true);
          expect(view.w).toBeGreaterThanOrEqual(previousWidth);
          previousWidth = view.w;
        }
      }),
      { numRuns: 300 },
    );
  });
});
