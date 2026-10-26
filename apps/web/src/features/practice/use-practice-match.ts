import { applyAction, chooseBotAction, createMatch, viewFor, type Action, type MatchState } from "@dominio/engine";
import { DEMO_RULES_BY_MODE, type GameMode } from "@dominio/protocol";
import { useCallback, useEffect, useState } from "react";
import { browserRng } from "../../lib/browser-rng.ts";
import { HUMAN_SEAT } from "./practice-table.ts";

/** Pause before a computer player moves, so the player can follow what happened. */
const BOT_DELAY_MS = 900;

export interface Practice {
  readonly mode: GameMode;
  readonly match: MatchState;
}

/** Moves here come from the player's screen or the bot, which only offer allowed moves: a rejection is a bug. */
function applyOrThrow(match: MatchState, seat: number, action: Action): MatchState {
  const result = applyAction(match, seat, action, browserRng);
  if (!result.ok) throw new Error(`practice: ${action.type} by seat ${seat} rejected: ${result.error}`);
  return result.state;
}

/**
 * A game against the computer, run entirely in the browser with the same rules as online, so it works
 * without the server. Computer players see only their own seat (chooseBotAction) and move one at a time.
 */
export function usePracticeMatch() {
  const [practice, setPractice] = useState<Practice | null>(null);

  const start = useCallback((mode: GameMode) => {
    setPractice({ mode, match: createMatch(DEMO_RULES_BY_MODE[mode], browserRng) });
  }, []);

  const stop = useCallback(() => {
    setPractice(null);
  }, []);

  /** The player's move for the state version they saw; a repeated tap on a newer state is dropped, like stale-version online. */
  const act = useCallback((action: Action, version: number) => {
    setPractice((current) => {
      if (current === null || current.match.version !== version) return current;
      return { ...current, match: applyOrThrow(current.match, HUMAN_SEAT, action) };
    });
  }, []);

  useEffect(() => {
    if (practice === null) return;
    const { match } = practice;
    if (match.phase !== "playing" || match.hand.turn === HUMAN_SEAT) return;
    const seat = match.hand.turn;
    const version = match.version;
    const timer = window.setTimeout(() => {
      setPractice((current) => {
        if (current === null || current.match.version !== version) return current;
        return { ...current, match: applyOrThrow(current.match, seat, chooseBotAction(viewFor(current.match, seat))) };
      });
    }, BOT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [practice]);

  return { practice, start, stop, act };
}
