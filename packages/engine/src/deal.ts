import type { RuleSet } from "./rules.ts";
import { shuffle, type Rng } from "./rng.ts";
import type { HandState } from "./state.ts";
import { compareTileWeight, createDoubleSixSet, isDouble, type Tile } from "./tiles.ts";

/**
 * Shuffles and deals a new hand.
 * @param opener seat that opens with any tile, or null to apply rules.opening.
 */
export function dealHand(rules: RuleSet, rng: Rng, opener: number | null): HandState {
  const shuffled = shuffle(createDoubleSixSet(), rng);
  const hands: Tile[][] = [];
  for (let seat = 0; seat < rules.seatCount; seat++) {
    hands.push(shuffled.slice(seat * rules.tilesPerPlayer, (seat + 1) * rules.tilesPerPlayer));
  }
  const stock = shuffled.slice(rules.seatCount * rules.tilesPerPlayer);
  const base = { hands, stock, board: [], openingIndex: 0, result: null };

  if (opener !== null) return { ...base, turn: opener, forcedOpeningTileId: null };
  if (rules.opening === "random-seat") {
    return { ...base, turn: rng.nextInt(rules.seatCount), forcedOpeningTileId: null };
  }

  const dealt = hands.flatMap((tiles, seat) => tiles.map((tile) => ({ tile, seat })));
  const doubles = dealt.filter((d) => isDouble(d.tile));
  const candidates = doubles.length > 0 ? doubles : dealt;
  const opening = candidates.reduce((best, d) => (compareTileWeight(d.tile, best.tile) > 0 ? d : best));
  return { ...base, turn: opening.seat, forcedOpeningTileId: opening.tile.id };
}
