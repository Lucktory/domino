import type { BoardEnd, PlacedTile } from "./state.ts";
import { hasPip, type Tile, type TileId } from "./tiles.ts";

export interface Move {
  readonly tileId: TileId;
  readonly end: BoardEnd;
}

export function getBoardEnds(board: readonly PlacedTile[]): { left: number; right: number } | null {
  const first = board[0];
  const last = board[board.length - 1];
  if (first === undefined || last === undefined) return null;
  return { left: first.left, right: last.right };
}

/** Every placement of every tile in `hand` that the board accepts. */
export function computeLegalMoves(
  hand: readonly Tile[],
  board: readonly PlacedTile[],
  forcedOpeningTileId: TileId | null,
): Move[] {
  const ends = getBoardEnds(board);
  if (ends === null) {
    return hand
      .filter((tile) => forcedOpeningTileId === null || tile.id === forcedOpeningTileId)
      .map((tile) => ({ tileId: tile.id, end: "left" }));
  }
  const moves: Move[] = [];
  for (const tile of hand) {
    if (hasPip(tile, ends.left)) moves.push({ tileId: tile.id, end: "left" });
    if (hasPip(tile, ends.right)) moves.push({ tileId: tile.id, end: "right" });
  }
  return moves;
}

/** Caller must have checked the move is legal. */
export function placeTile(board: readonly PlacedTile[], tile: Tile, end: BoardEnd): PlacedTile[] {
  const ends = getBoardEnds(board);
  if (ends === null) return [{ tile, left: tile.high, right: tile.low }];
  if (end === "left") {
    const right = ends.left;
    const left = tile.low === right ? tile.high : tile.low;
    return [{ tile, left, right }, ...board];
  }
  const left = ends.right;
  const right = tile.low === left ? tile.high : tile.low;
  return [...board, { tile, left, right }];
}
