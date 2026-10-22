import { randomInt } from "node:crypto";
import type { Rng } from "@dominio/engine";

/** Cryptographic randomness for real deals: shuffles cannot be predicted from earlier ones. */
export const cryptoRng: Rng = {
  nextInt: (maxExclusive) => randomInt(maxExclusive),
};
