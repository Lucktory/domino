const MAX_PIP = 6;

export type TileId = `${number}-${number}`;

export interface Tile {
  readonly id: TileId;
  readonly low: number;
  readonly high: number;
}

export function createTile(a: number, b: number): Tile {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return { id: `${low}-${high}`, low, high };
}

/** The 28 tiles of a double-six set, in a fixed order. */
export function createDoubleSixSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let low = 0; low <= MAX_PIP; low++) {
    for (let high = low; high <= MAX_PIP; high++) {
      tiles.push(createTile(low, high));
    }
  }
  return tiles;
}

export function isDouble(tile: Tile): boolean {
  return tile.low === tile.high;
}

export function hasPip(tile: Tile, pip: number): boolean {
  return tile.low === pip || tile.high === pip;
}

export function computePipCount(tiles: readonly Tile[]): number {
  return tiles.reduce((sum, tile) => sum + tile.low + tile.high, 0);
}

/** Heavier = more pips; ties broken by the higher end (6-0 beats 5-1). Unique within a set. */
export function compareTileWeight(a: Tile, b: Tile): number {
  const bySum = a.low + a.high - (b.low + b.high);
  return bySum !== 0 ? bySum : a.high - b.high;
}
