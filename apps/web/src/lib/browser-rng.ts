import type { Rng } from "@dominio/engine";

const RANGE = 2 ** 32;

/** Uniform integers from the browser's cryptographic source, for deals in games against the computer. */
export const browserRng: Rng = {
  nextInt(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > RANGE) {
      throw new Error(`nextInt: invalid bound ${maxExclusive}`);
    }
    // Rejection sampling: values in the incomplete top band are drawn again, so every result is equally likely.
    const limit = RANGE - (RANGE % maxExclusive);
    const buffer = new Uint32Array(1);
    for (;;) {
      crypto.getRandomValues(buffer);
      const [value] = buffer;
      if (value === undefined) throw new Error("getRandomValues returned no value");
      if (value < limit) return value % maxExclusive;
    }
  },
};
