import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Guest identity for the demo: a random player id plus an HMAC signature, kept in the
 * phone's storage so a reconnecting player gets their seat back. Replaced by real
 * accounts in the wallet phase.
 */
export interface SessionTokens {
  issue(playerId: string): string;
  /** The player id, or null if the token was not signed by this server. */
  verify(token: string): string | null;
}

export function createSessionTokens(secret: string): SessionTokens {
  const sign = (playerId: string) => createHmac("sha256", secret).update(playerId).digest("base64url");
  return {
    issue: (playerId) => `${playerId}.${sign(playerId)}`,
    verify: (token) => {
      const separator = token.lastIndexOf(".");
      if (separator <= 0) return null;
      const playerId = token.slice(0, separator);
      const given = Buffer.from(token.slice(separator + 1));
      const expected = Buffer.from(sign(playerId));
      return given.length === expected.length && timingSafeEqual(given, expected) ? playerId : null;
    },
  };
}
