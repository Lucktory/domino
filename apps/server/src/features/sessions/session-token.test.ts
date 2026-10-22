import { describe, expect, it } from "vitest";
import { createSessionTokens } from "./session-token.ts";

const tokens = createSessionTokens("x".repeat(32));

describe("session tokens", () => {
  it("round-trips a player id", () => {
    expect(tokens.verify(tokens.issue("player-1"))).toBe("player-1");
  });

  it("rejects a token with a changed player id or signature", () => {
    const token = tokens.issue("player-1");
    expect(tokens.verify(token.replace("player-1", "player-2"))).toBeNull();
    expect(tokens.verify(`${token}x`)).toBeNull();
    expect(tokens.verify("garbage")).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const other = createSessionTokens("y".repeat(32));
    expect(tokens.verify(other.issue("player-1"))).toBeNull();
  });
});
