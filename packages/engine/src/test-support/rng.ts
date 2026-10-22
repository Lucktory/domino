import { getAt } from "../indexing.ts";
import type { Rng } from "../rng.ts";

/** Deterministic PRNG (mulberry32). Tests only: not suitable for real deals. */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    nextInt(maxExclusive) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(unit * maxExclusive);
    },
  };
}

/**
 * Rng that makes `shuffle(source)` return exactly `target`, so a test can choose the deal.
 * Values for extra calls (e.g. random-seat opener) come from `then`.
 */
export function createRngForOrder<T>(source: readonly T[], target: readonly T[], then: number[] = []): Rng {
  const working = [...source];
  const picks: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(getAt(target, i));
    if (j < 0 || j > i) throw new Error("target is not a permutation of source");
    picks.push(j);
    const a = getAt(working, i);
    working[i] = getAt(working, j);
    working[j] = a;
  }
  const queue = [...picks, ...then];
  return {
    nextInt(maxExclusive) {
      const value = queue.shift();
      if (value === undefined || value >= maxExclusive) throw new Error("scripted rng exhausted or out of range");
      return value;
    },
  };
}
