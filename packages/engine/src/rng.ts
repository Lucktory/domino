import { getAt } from "./indexing.ts";

/**
 * Source of randomness, injected so the server can use a cryptographic source
 * and tests can use a fixed sequence.
 */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** Fisher-Yates shuffle. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const a = getAt(result, i);
    result[i] = getAt(result, j);
    result[j] = a;
  }
  return result;
}
