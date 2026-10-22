import { createDoubleSixSet } from "./tiles.ts";

/**
 * Every game rule the client decides lives here. A game mode is a RuleSet value,
 * not new code.
 */
export interface RuleSet {
  /** Players at the table (2, 3 or 4). */
  readonly seatCount: number;
  /**
   * none: every seat plays for itself.
   * pairs: 4 seats, partners sit opposite (seats 0 + 2 against 1 + 3) and win or lose together.
   */
  readonly teams: "none" | "pairs";
  readonly tilesPerPlayer: number;
  /**
   * What a player with no legal move does.
   * draw: takes tiles from the stock until one fits; passes only when the stock is empty.
   * pass: passes; undealt tiles stay out of play.
   */
  readonly whenNoMove: "draw" | "pass";
  /**
   * Who opens the first hand.
   * highest-double: holder of the highest double opens and must play it; if no double
   *   was dealt, holder of the heaviest tile opens with it.
   * random-seat: a random seat opens with any tile.
   */
  readonly opening: "highest-double" | "random-seat";
  readonly match: SingleHandMatch | PointsMatch;
  /** Seconds a player has for each action; every accepted action restarts the clock. */
  readonly turnSeconds: number;
  /** Consecutive timeouts by the same seat that lose the match (earlier ones just pass the turn). */
  readonly timeoutStrikesToForfeit: number;
}

interface SingleHandMatch {
  readonly kind: "single-hand";
}

interface PointsMatch {
  readonly kind: "points";
  /** First side (seat, or team in pairs) to reach this many points wins the match. */
  readonly target: number;
  /**
   * Who opens hands after the first. previous-winner falls back to the opening rule
   * when the previous hand had no winner.
   */
  readonly laterHandsOpener: "previous-winner" | "opening-rule";
}

export function validateRuleSet(rules: RuleSet): string[] {
  const problems: string[] = [];
  const setSize = createDoubleSixSet().length;
  if (!Number.isInteger(rules.seatCount) || rules.seatCount < 2 || rules.seatCount > 4) {
    problems.push("seatCount must be 2, 3 or 4");
  }
  if (!Number.isInteger(rules.tilesPerPlayer) || rules.tilesPerPlayer < 1) {
    problems.push("tilesPerPlayer must be a positive integer");
  }
  if (rules.teams === "pairs" && rules.seatCount !== 4) {
    problems.push("teams pairs needs seatCount 4");
  }
  if (rules.teams === "pairs" && rules.match.kind === "points" && rules.match.laterHandsOpener === "previous-winner") {
    // A hand is won by a team, so there is no single winning seat to open the next one.
    problems.push("teams pairs cannot use laterHandsOpener previous-winner");
  }
  if (rules.seatCount * rules.tilesPerPlayer > setSize) {
    problems.push(`seatCount * tilesPerPlayer must not exceed ${setSize}`);
  }
  if (rules.match.kind === "points" && (!Number.isInteger(rules.match.target) || rules.match.target < 1)) {
    problems.push("match.target must be a positive integer");
  }
  if (!Number.isFinite(rules.turnSeconds) || rules.turnSeconds <= 0) {
    problems.push("turnSeconds must be a positive number");
  }
  if (!Number.isInteger(rules.timeoutStrikesToForfeit) || rules.timeoutStrikesToForfeit < 1) {
    problems.push("timeoutStrikesToForfeit must be a positive integer");
  }
  return problems;
}

/**
 * The side a seat plays for. Results and scores are kept per side: in pairs a side is a team
 * (seats 0 + 2 are side 0, seats 1 + 3 are side 1); otherwise each seat is its own side.
 */
export function deriveSide(rules: RuleSet, seat: number): number {
  return rules.teams === "pairs" ? seat % 2 : seat;
}

/** How many sides play: 2 teams in pairs, otherwise one per seat. */
export function countSides(rules: RuleSet): number {
  return rules.teams === "pairs" ? 2 : rules.seatCount;
}
