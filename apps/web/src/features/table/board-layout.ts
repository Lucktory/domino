import type { BoardEnd, PlacedTile } from "@dominio/engine";

/** A rectangle in board coordinates (x grows right, y grows down, origin at the opening tile). */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface PositionedTile extends Rect {
  readonly placed: PlacedTile;
  readonly vertical: boolean;
  /** Pips drawn on the left (or top) half, then the right (or bottom) half. */
  readonly first: number;
  readonly second: number;
  /** This tile is the open end of the chain on that side. */
  readonly end: BoardEnd | null;
  /** Upright tile where the chain turns into the next row. */
  readonly corner: boolean;
}

/** The open number at one end of the chain, anchored on the outer edge of the end tile. */
interface EndBadge {
  readonly x: number;
  readonly y: number;
  readonly pip: number;
}

export interface BoardLayout {
  readonly tiles: readonly PositionedTile[];
  /** Where the next tile on each end would go: tap targets when a tile fits both ends. */
  readonly slots: Readonly<Record<BoardEnd, Rect>>;
  /** Open numbers at both ends; null on an empty board. */
  readonly ends: Readonly<Record<BoardEnd, EndBadge>> | null;
}

/** Tiles are laid within this distance of the center (16 tile lengths across: a wide, landscape table). */
const TABLE_PLAY_HALF_WIDTH = 16;

/**
 * The fixed table every player sees, in table units, centered on the opening tile. It holds the
 * longest possible chain (all 28 tiles) plus room for the end badges; see board-layout.test.ts.
 */
export const TABLE: Readonly<Rect> = { x: -16.5, y: -5.75, w: 33, h: 11.5 };

type Direction = 1 | -1;

interface Walker {
  /** Outer edge of the last tile: its right edge when moving right, its left edge when moving left. */
  edge: number;
  direction: Direction;
  rowCenter: number;
  /** Vertical extent of the last tile, so a corner can sit right under (or over) it. */
  lastTop: number;
  lastBottom: number;
}

interface Spot extends Rect {
  readonly corner: boolean;
  readonly next: Walker;
}

/** End badges are circles of this radius around their anchor (board.tsx draws them 0.85 across). */
const BADGE_REACH = 0.45;

/**
 * The open number at an end: just outside the end tile's outer edge (x, y), pushed out along (dx, dy) so
 * it does not cover the pips, but never past the table edge.
 */
function badgeAt(x: number, y: number, dx: number, dy: number, pip: number): EndBadge {
  return {
    x: clamp(x + dx * BADGE_REACH, TABLE.x + BADGE_REACH, TABLE.x + TABLE.w - BADGE_REACH),
    y: clamp(y + dy * BADGE_REACH, TABLE.y + BADGE_REACH, TABLE.y + TABLE.h - BADGE_REACH),
    pip,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Lays the chain out like a real table: the opening tile in the middle, the right branch growing
 * right and turning down at the edge, the left branch growing left and turning up. At each turn an
 * upright corner tile hangs from the outer end of the row and the next row runs back from it.
 * Each tile keeps its position as new tiles are added, so nothing jumps around during play.
 *
 * Everything is in table units (a tile is 2 x 1) on a table of fixed width, never in screen pixels,
 * so every player gets exactly the same arrangement; the screen only scales the finished picture.
 */
export function computeBoardLayout(board: readonly PlacedTile[], openingIndex: number): BoardLayout {
  const short = 1;
  const long = 2;
  const gap = 0.1;
  const rowStep = long + gap;
  const half = TABLE_PLAY_HALF_WIDTH;

  const sizeOf = (p: PlacedTile) => (p.left === p.right ? { w: short, h: long } : { w: long, h: short });

  const opening = board[openingIndex];
  if (opening === undefined) {
    const empty: Rect = { x: -long / 2, y: -short / 2, w: long, h: short };
    return { tiles: [], slots: { left: empty, right: empty }, ends: null };
  }

  const tiles: PositionedTile[] = [];
  const openingSize = sizeOf(opening);
  const openingRect: Rect = { x: -openingSize.w / 2, y: -openingSize.h / 2, w: openingSize.w, h: openingSize.h };
  tiles.push({
    ...openingRect,
    placed: opening,
    vertical: openingSize.w === short,
    first: opening.left,
    second: opening.right,
    end: null,
    corner: false,
  });

  /** Next position on a branch for a tile of size w x h; at the edge it becomes an upright corner. */
  const step = (walker: Walker, w: number, h: number, rowDirection: Direction): Spot => {
    const { edge, direction, rowCenter, lastTop, lastBottom } = walker;
    const x = direction === 1 ? edge + gap : edge - gap - w;
    if (x >= -half && x + w <= half) {
      const y = rowCenter - h / 2;
      const nextEdge = direction === 1 ? x + w : x;
      return { x, y, w, h, corner: false, next: { edge: nextEdge, direction, rowCenter, lastTop: y, lastBottom: y + h } };
    }
    // Corner: upright under (or over) the outer end of the last tile; its far half lines up with the next row.
    const cornerX = direction === 1 ? edge - short : edge;
    const cornerY = rowDirection === 1 ? lastBottom + gap : lastTop - gap - long;
    return {
      x: cornerX,
      y: cornerY,
      w: short,
      h: long,
      corner: true,
      next: {
        edge: direction === 1 ? cornerX : cornerX + short,
        direction: direction === 1 ? -1 : 1,
        rowCenter: rowCenter + rowDirection * rowStep,
        lastTop: cornerY,
        lastBottom: cornerY + long,
      },
    };
  };

  const walkBranch = (outward: readonly PlacedTile[], side: BoardEnd): { slot: Rect; end: EndBadge } => {
    // Right branch turns down (+1), left branch turns up (-1), so they never cross.
    const rowDirection: Direction = side === "right" ? 1 : -1;
    const outwardX: Direction = side === "right" ? 1 : -1;
    let walker: Walker = {
      edge: side === "right" ? openingRect.x + openingRect.w : openingRect.x,
      direction: side === "right" ? 1 : -1,
      rowCenter: 0,
      lastTop: openingRect.y,
      lastBottom: openingRect.y + openingRect.h,
    };
    let end = badgeAt(side === "right" ? openingRect.x + openingRect.w : openingRect.x, 0, outwardX, 0, side === "right" ? opening.right : opening.left);

    outward.forEach((placed, i) => {
      const size = sizeOf(placed);
      const spot = step(walker, size.w, size.h, rowDirection);
      // The pip that touches the chain must face the previous tile.
      const touching = side === "right" ? placed.left : placed.right;
      const outer = side === "right" ? placed.right : placed.left;
      let first: number;
      let second: number;
      if (spot.corner) {
        // Upright: the touching half points back at the row it hangs from.
        [first, second] = rowDirection === 1 ? [touching, outer] : [outer, touching];
      } else {
        const facesRight = spot.next.direction === 1;
        [first, second] = facesRight ? [touching, outer] : [outer, touching];
      }
      tiles.push({
        placed,
        x: spot.x,
        y: spot.y,
        w: spot.w,
        h: spot.h,
        vertical: spot.corner || size.w === short,
        first,
        second,
        end: i === outward.length - 1 ? side : null,
        corner: spot.corner,
      });
      end = spot.corner
        ? badgeAt(spot.x + spot.w / 2, rowDirection === 1 ? spot.y + spot.h : spot.y, 0, rowDirection, outer)
        : badgeAt(spot.next.direction === 1 ? spot.x + spot.w : spot.x, spot.y + spot.h / 2, spot.next.direction, 0, outer);
      walker = spot.next;
    });
    const slot = step(walker, long, short, rowDirection);
    return { slot: { x: slot.x, y: slot.y, w: slot.w, h: slot.h }, end };
  };

  const right = walkBranch(board.slice(openingIndex + 1), "right");
  const left = walkBranch(board.slice(0, openingIndex).reverse(), "left");

  return { tiles, slots: { left: left.slot, right: right.slot }, ends: { left: left.end, right: right.end } };
}


/**
 * Zoom levels, as fractions of the full table. The view starts close (big tiles) and steps out only when
 * the chain needs the room: at most three zoom-outs per hand.
 */
const CLOSER_ZOOM_STEPS = [0.4, 0.55, 0.75] as const;
/** Space kept between the outermost tile, slot or badge and the edge of the view. */
const VIEW_MARGIN = 0.3;

/**
 * The part of the table to show: the closest zoom step that still holds every tile, slot and badge,
 * centered on the chain (a chain growing to one side does not waste half the view) and kept inside the
 * table. It depends only on the board, so both players always see the same view; as the chain only grows
 * during a hand, the view only steps out.
 */
export function computeView(layout: BoardLayout): Rect {
  const rects: Rect[] = [...layout.tiles, layout.slots.left, layout.slots.right];
  for (const badge of Object.values(layout.ends ?? {})) {
    rects.push({ x: badge.x - BADGE_REACH, y: badge.y - BADGE_REACH, w: 2 * BADGE_REACH, h: 2 * BADGE_REACH });
  }
  const left = Math.min(...rects.map((r) => r.x)) - VIEW_MARGIN;
  const right = Math.max(...rects.map((r) => r.x + r.w)) + VIEW_MARGIN;
  const top = Math.min(...rects.map((r) => r.y)) - VIEW_MARGIN;
  const bottom = Math.max(...rects.map((r) => r.y + r.h)) + VIEW_MARGIN;
  const step = CLOSER_ZOOM_STEPS.find((k) => right - left <= TABLE.w * k && bottom - top <= TABLE.h * k);
  // No closer step fits: show the whole table, which always holds the chain (board-layout.test.ts).
  if (step === undefined) return TABLE;
  const w = TABLE.w * step;
  const h = TABLE.h * step;
  // Everything lies inside the table and fits in w x h, so the clamped view still holds it all.
  return {
    x: clamp((left + right) / 2 - w / 2, TABLE.x, TABLE.x + TABLE.w - w),
    y: clamp((top + bottom) / 2 - h / 2, TABLE.y, TABLE.y + TABLE.h - h),
    w,
    h,
  };
}
