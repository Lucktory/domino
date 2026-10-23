import { createMatch } from "@dominio/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cryptoRng } from "../../lib/crypto-rng.ts";
import type { Table } from "./table.ts";
import { createTurnClock } from "./turn-clock.ts";
import { DEMO_RULES_BY_MODE } from "./demo-rules.ts";

const DEMO_RULES = DEMO_RULES_BY_MODE["1v1"];

function tableAt(version: number | null, deadline: number | null): Table {
  return {
    id: "t1",
    code: "ABCDEF",
    visibility: "public",
    mode: "1v1",
    rules: DEMO_RULES,
    seats: [null, null],
    closed: false,
    turnDeadline: deadline,
    match: version === null ? null : { ...createMatch(DEMO_RULES, cryptoRng), version },
  };
}

describe("createTurnClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once at the deadline with the version it was set for", () => {
    const due = vi.fn();
    const clock = createTurnClock(due);
    clock.track(tableAt(3, 15_000));
    vi.advanceTimersByTime(14_999);
    expect(due).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(due).toHaveBeenCalledExactlyOnceWith("t1", 3);
  });

  it("re-tracking the same turn keeps one timer; a new turn replaces it; no clock cancels it", () => {
    const due = vi.fn();
    const clock = createTurnClock(due);
    clock.track(tableAt(3, 15_000));
    clock.track(tableAt(3, 15_000));
    clock.track(tableAt(4, 20_000));
    vi.advanceTimersByTime(20_000);
    expect(due).toHaveBeenCalledExactlyOnceWith("t1", 4);
    clock.track(tableAt(5, 35_000));
    clock.track(tableAt(6, null));
    vi.advanceTimersByTime(60_000);
    expect(due).toHaveBeenCalledTimes(1);
  });

  it("if the clock is behind when the timer fires, it waits out the rest instead of dropping the turn", () => {
    const due = vi.fn();
    const lag = { ms: 0 };
    const clock = createTurnClock(due, () => Date.now() - lag.ms);
    clock.track(tableAt(3, 15_000));
    lag.ms = 5; // the system clock steps back 5 ms before the deadline
    vi.advanceTimersByTime(15_000);
    expect(due).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5);
    expect(due).toHaveBeenCalledExactlyOnceWith("t1", 3);
  });

  it("stopAll cancels pending timers", () => {
    const due = vi.fn();
    const clock = createTurnClock(due);
    clock.track(tableAt(3, 15_000));
    clock.stopAll();
    vi.advanceTimersByTime(60_000);
    expect(due).not.toHaveBeenCalled();
  });
});
