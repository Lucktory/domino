import type { Move } from "./board.ts";
import { getAt } from "./indexing.ts";
import type { Action } from "./state.ts";
import type { Tile } from "./tiles.ts";
import type { PlayerView } from "./view.ts";

/** Doubles go first (they fit only one number), then the heaviest tile, to unload points early. */
function rank(tile: Tile): number {
  return (tile.low === tile.high ? 100 : 0) + tile.low + tile.high;
}

/**
 * The computer player's move. It decides from its own seat's view only, exactly what a person in that
 * seat would see, so it cannot peek at other hands or the pile. Deterministic: the same view always gets
 * the same move. Asking for a move when it is not this seat's turn is a caller bug.
 */
export function chooseBotAction(view: PlayerView): Action {
  if (view.phase !== "playing" || view.turn !== view.seat) {
    throw new Error(`bot asked to move at seat ${view.seat}, but it is not its turn`);
  }
  if (view.legalMoves.length > 0) {
    const tileOf = (move: Move) => {
      const tile = view.hand.find((t) => t.id === move.tileId);
      if (tile === undefined) throw new Error(`legal move with tile ${move.tileId} not in hand`);
      return tile;
    };
    // Highest rank wins; on a tie the first listed move (stable), so the choice is repeatable.
    const best = view.legalMoves.reduce((a, b) => (rank(tileOf(b)) > rank(tileOf(a)) ? b : a), getAt(view.legalMoves, 0));
    return { type: "play", tileId: best.tileId, end: best.end };
  }
  if (view.canDraw) return { type: "draw" };
  if (view.canPass) return { type: "pass" };
  throw new Error(`bot at seat ${view.seat} has no allowed action`);
}
