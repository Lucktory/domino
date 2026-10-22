import { deriveSide, type HandResult, type PlayerView } from "@dominio/engine";

/**
 * How the hand ended for this player (for their team, in pairs). The one place that decides victory,
 * defeat or tie; the result screen only chooses how each one looks.
 */
export type Outcome =
  | { readonly kind: "win"; readonly reason: HandResult["kind"]; readonly points: number; readonly leaver: number | null }
  /** winnerSide: the winning seat, or the winning team in pairs (see deriveSide); null when nobody won. */
  | {
      readonly kind: "loss";
      readonly reason: HandResult["kind"];
      readonly winnerSide: number | null;
      readonly points: number;
      readonly leaver: number | null;
    }
  | { readonly kind: "tie"; readonly reason: HandResult["kind"]; readonly leaver: number | null };

/** null while the hand is still being played. A player whose side left always lost, even if nobody won. */
export function deriveOutcome(game: PlayerView): Outcome | null {
  const result = game.handResult;
  if (result === null) return null;
  const { kind: reason, points, leaver, winner } = result;
  const mySide = deriveSide(game.rules, game.seat);
  const iLeft = leaver !== null && deriveSide(game.rules, leaver) === mySide;
  if (!iLeft && winner === null) return { kind: "tie", reason, leaver };
  if (!iLeft && winner === mySide) return { kind: "win", reason, points, leaver };
  return { kind: "loss", reason, winnerSide: winner, points, leaver };
}

/**
 * What the player should be doing right now.
 * opening: you open and the rules force one tile. choose-end: a selected tile fits both ends.
 * play: pick a tile. must-draw / must-pass: no tile fits. their-turn / hand-over: wait.
 */
export type TurnMoment = "opening" | "choose-end" | "play" | "must-draw" | "must-pass" | "their-turn" | "hand-over";

export function deriveTurnMoment(game: PlayerView, choosingEnd: boolean): TurnMoment {
  if (game.phase !== "playing") return "hand-over";
  if (game.turn !== game.seat) return "their-turn";
  if (choosingEnd) return "choose-end";
  if (game.canDraw) return "must-draw";
  if (game.canPass) return "must-pass";
  // On an empty board every tile is playable unless the rules force one.
  if (game.board.length === 0 && game.legalMoves.length === 1 && game.hand.length > 1) return "opening";
  return "play";
}

export function isMyMoment(moment: TurnMoment): boolean {
  return moment !== "their-turn" && moment !== "hand-over";
}
