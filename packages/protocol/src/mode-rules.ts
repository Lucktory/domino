import type { RuleSet } from "@dominio/engine";
import type { GameMode } from "./client-events.ts";

/** Decided by the user (2026-10-22): 15 s per action, two timeouts in a row lose the match. */
const TURN_RULES = { turnSeconds: 15, timeoutStrikesToForfeit: 2 } as const;

/**
 * PENDING CLIENT CONFIRMATION. Placeholder values so the demo can be played, one rule set per game mode.
 * Every value here is a question open with the client (tiles per player, draw or pass, who opens, single
 * hand or to points). Change them here only; nothing else hardcodes rules. Shared by the server (online
 * tables) and the browser (games against the computer), so both always play the same rules.
 */
export const DEMO_RULES_BY_MODE: Readonly<Record<GameMode, RuleSet>> = {
  "1v1": {
    seatCount: 2,
    teams: "none",
    tilesPerPlayer: 7,
    whenNoMove: "draw",
    opening: "highest-double",
    match: { kind: "single-hand" },
    ...TURN_RULES,
  },
  // Most common Draw game for 3 and 4 players (user, 2026-10-23): 5 tiles each, draw until a tile fits.
  "3p": {
    seatCount: 3,
    teams: "none",
    tilesPerPlayer: 5,
    whenNoMove: "draw",
    opening: "highest-double",
    match: { kind: "single-hand" },
    ...TURN_RULES,
  },
  "4p": {
    seatCount: 4,
    teams: "none",
    tilesPerPlayer: 5,
    whenNoMove: "draw",
    opening: "highest-double",
    match: { kind: "single-hand" },
    ...TURN_RULES,
  },
  // Simplest pairs game (user, 2026-10-23): every tile dealt so nobody draws, double six opens, one hand.
  "2v2": {
    seatCount: 4,
    teams: "pairs",
    tilesPerPlayer: 7,
    whenNoMove: "pass",
    opening: "highest-double",
    match: { kind: "single-hand" },
    ...TURN_RULES,
  },
};
