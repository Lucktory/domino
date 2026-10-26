import { describe, expect, it } from "vitest";
import { cryptoRng } from "../../lib/crypto-rng.ts";
import { DEMO_RULES_BY_MODE } from "@dominio/protocol";
import { createTableQueue } from "./table-queue.ts";
import { createTableService, type TableResult } from "./table-service.ts";
import { createInMemoryTableStore } from "./table-store.ts";
import type { Table } from "./table.ts";

/** Fake server clock for the turn timer. */
const clock = { ms: 1_000_000 };

function makeService(generateCode?: () => string) {
  return createTableService({
    store: createInMemoryTableStore(),
    queue: createTableQueue(),
    rulesByMode: DEMO_RULES_BY_MODE,
    rng: cryptoRng,
    now: () => clock.ms,
    ...(generateCode === undefined ? {} : { generateCode }),
  });
}

function expectTable(result: TableResult): Table {
  if (!result.ok) throw new Error(`expected a table, got ${result.error}`);
  return result.table;
}

async function startedTable() {
  const service = makeService();
  const created = expectTable(await service.createPrivateTable("p1", "Ana"));
  const table = expectTable(await service.joinTable(created.code, "p2", "Beto"));
  if (table.match === null) throw new Error("match should have started");
  return { service, table, match: table.match };
}

describe("createPrivateTable", () => {
  it("seats the host and waits for opponents", async () => {
    const table = expectTable(await makeService().createPrivateTable("p1", "Ana"));
    expect(table.seats).toEqual([{ playerId: "p1", nickname: "Ana", connected: true, left: false }, null]);
    expect(table).toMatchObject({ visibility: "private", match: null, closed: false });
    expect(table.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("returns the same waiting table on a repeated or concurrent request", async () => {
    const service = makeService();
    const [a, b] = await Promise.all([service.createPrivateTable("p1", "Ana"), service.createPrivateTable("p1", "Ana")]);
    expect(expectTable(a).id).toBe(expectTable(b).id);
  });

  it("uses the latest nickname when it returns the same table", async () => {
    const service = makeService();
    await service.createPrivateTable("p1", "Ana");
    const again = expectTable(await service.createPrivateTable("p1", "Ana Maria"));
    expect(again.seats[0]?.nickname).toBe("Ana Maria");
  });

  it("retries when a generated code is taken", async () => {
    const codes = ["AAAAAA", "AAAAAA", "BBBBBB"];
    const service = makeService(() => codes.shift() ?? "ZZZZZZ");
    expect(expectTable(await service.createPrivateTable("p1", "Ana")).code).toBe("AAAAAA");
    expect(expectTable(await service.createPrivateTable("p2", "Beto")).code).toBe("BBBBBB");
  });

  it("fails loudly when no free code can be found", async () => {
    const service = makeService(() => "AAAAAA");
    await service.createPrivateTable("p1", "Ana");
    await expect(service.createPrivateTable("p2", "Beto")).rejects.toThrow(/No free table code/);
  });

  it("is refused while the player is in a live match", async () => {
    const { service } = await startedTable();
    expect(await service.createPrivateTable("p1", "Ana")).toEqual({ ok: false, error: "already-playing" });
  });
});

describe("quickMatch", () => {
  it("opens a public table when nobody is waiting, and pairs the next player into it", async () => {
    const service = makeService();
    const first = expectTable(await service.quickMatch("p1", "Ana", "1v1"));
    expect(first).toMatchObject({ visibility: "public", match: null });
    const second = expectTable(await service.quickMatch("p2", "Beto", "1v1"));
    expect(second.id).toBe(first.id);
    expect(second.match?.phase).toBe("playing");
  });

  it("pairs two players searching at the same moment instead of opening two tables", async () => {
    const service = makeService();
    const [a, b] = await Promise.all([service.quickMatch("p1", "Ana", "1v1"), service.quickMatch("p2", "Beto", "1v1")]);
    expect(expectTable(a).id).toBe(expectTable(b).id);
  });

  it("is idempotent while searching", async () => {
    const service = makeService();
    const [a, b] = await Promise.all([service.quickMatch("p1", "Ana", "1v1"), service.quickMatch("p1", "Ana", "1v1")]);
    expect(expectTable(a).id).toBe(expectTable(b).id);
    expect(expectTable(b).match).toBeNull();
  });

  it("never pairs into private tables", async () => {
    const service = makeService();
    const privateTable = expectTable(await service.createPrivateTable("p1", "Ana"));
    const found = expectTable(await service.quickMatch("p2", "Beto", "1v1"));
    expect(found.id).not.toBe(privateTable.id);
  });

  it("leaves the player's waiting private table before searching", async () => {
    const service = makeService();
    const privateTable = expectTable(await service.createPrivateTable("p1", "Ana"));
    await service.quickMatch("p1", "Ana", "1v1");
    expect(await service.joinTable(privateTable.code, "p2", "Beto")).toEqual({ ok: false, error: "table-not-found" });
  });
});

describe("quickMatch 2 vs 2", () => {
  it("seats four players at one table and starts a pairs match only when it is full", async () => {
    const service = makeService();
    const names = ["Ana", "Beto", "Caro", "Dani"];
    const tables: Table[] = [];
    for (const [i, name] of names.entries()) tables.push(expectTable(await service.quickMatch(`p${i}`, name, "2v2")));
    expect(new Set(tables.map((t) => t.id)).size).toBe(1);
    expect(tables.slice(0, 3).every((t) => t.match === null)).toBe(true);
    const full = tables.at(-1);
    expect(full).toMatchObject({ visibility: "public", mode: "2v2", rules: DEMO_RULES_BY_MODE["2v2"] });
    expect(full?.seats.map((seat) => seat?.nickname)).toEqual(names);
    expect(full?.match?.phase).toBe("playing");
  });

  it("never mixes modes: a 1 vs 1 search and a 2 vs 2 search get different tables", async () => {
    const service = makeService();
    const pairs = expectTable(await service.quickMatch("p1", "Ana", "2v2"));
    const single = expectTable(await service.quickMatch("p2", "Beto", "1v1"));
    expect(single.id).not.toBe(pairs.id);
    expect(single).toMatchObject({ mode: "1v1", match: null });
  });

  it("searching in another mode leaves the first search", async () => {
    const service = makeService();
    const first = expectTable(await service.quickMatch("p1", "Ana", "2v2"));
    const second = expectTable(await service.quickMatch("p1", "Ana", "1v1"));
    expect(second.id).not.toBe(first.id);
    const other = expectTable(await service.quickMatch("p2", "Beto", "2v2"));
    expect(other.id).not.toBe(first.id);
  });

  it("3 and 4 players: the table waits for every seat, then deals 5 tiles each with a pile to draw from", async () => {
    for (const [mode, seats] of [["3p", 3], ["4p", 4]] as const) {
      const service = makeService();
      let table: Table | null = null;
      for (let i = 0; i < seats; i++) {
        table = expectTable(await service.quickMatch(`${mode}-${i}`, `P${i}`, mode));
        if (i < seats - 1) expect(table.match).toBeNull();
      }
      expect(table).toMatchObject({ mode, rules: DEMO_RULES_BY_MODE[mode] });
      expect(table?.match?.hand.hands.map((h) => h.length)).toEqual(Array.from({ length: seats }, () => 5));
      expect(table?.match?.hand.stock).toHaveLength(28 - 5 * seats);
    }
  });

  it("private tables are 1 vs 1", async () => {
    const table = expectTable(await makeService().createPrivateTable("p1", "Ana"));
    expect(table).toMatchObject({ mode: "1v1", rules: DEMO_RULES_BY_MODE["1v1"] });
    expect(table.seats).toHaveLength(2);
  });
});

describe("joinTable", () => {
  it("starts the match when the last seat fills", async () => {
    const { table, match } = await startedTable();
    expect(table.seats.map((s) => s?.playerId)).toEqual(["p1", "p2"]);
    expect(match.phase).toBe("playing");
  });

  it("is idempotent for a player already seated", async () => {
    const { service, table, match } = await startedTable();
    const again = expectTable(await service.joinTable(table.code, "p2", "Beto"));
    expect(again.match?.version).toBe(match.version);
  });

  it("rejects unknown codes and full tables without touching the player's own waiting table", async () => {
    const { service, table } = await startedTable();
    const own = expectTable(await service.createPrivateTable("p3", "Caro"));
    expect(await service.joinTable("ZZZZZZ", "p3", "Caro")).toEqual({ ok: false, error: "table-not-found" });
    expect(await service.joinTable(table.code, "p3", "Caro")).toEqual({ ok: false, error: "table-full" });
    expect((await service.getCurrentTable("p3"))?.id).toBe(own.id);
  });
});

describe("leaveTable", () => {
  it("frees the seat of a waiting table and closes it when empty", async () => {
    const service = makeService();
    const table = expectTable(await service.createPrivateTable("p1", "Ana"));
    const left = expectTable(await service.leaveTable(table.id, "p1"));
    expect(left).toMatchObject({ closed: true, seats: [null, null] });
    expect(await service.getCurrentTable("p1")).toBeNull();
    expect(await service.joinTable(table.code, "p2", "Beto")).toEqual({ ok: false, error: "table-not-found" });
  });

  it("forfeits a live match: the opponent wins at once, and the leaver's table is gone for them", async () => {
    const { service, table } = await startedTable();
    const left = expectTable(await service.leaveTable(table.id, "p2"));
    expect(left.match).toMatchObject({ phase: "finished", winner: 0 });
    expect(left.match?.hand.result?.kind).toBe("forfeit");
    expect(left.seats[1]?.left).toBe(true);
    expect(await service.getCurrentTable("p2")).toBeNull();
    expect((await service.getCurrentTable("p1"))?.id).toBe(table.id);
  });

  it("after the result, leaving only hides the table from that player", async () => {
    const { service, table } = await startedTable();
    await service.leaveTable(table.id, "p2");
    const hostLeft = expectTable(await service.leaveTable(table.id, "p1"));
    expect(hostLeft.match?.winner).toBe(0);
    expect(await service.getCurrentTable("p1")).toBeNull();
  });

  it("is idempotent and rejects strangers", async () => {
    const { service, table } = await startedTable();
    await service.leaveTable(table.id, "p2");
    expect((await service.leaveTable(table.id, "p2")).ok).toBe(true);
    expect(await service.leaveTable(table.id, "p9")).toEqual({ ok: false, error: "not-seated" });
    expect(await service.leaveTable("00000000-0000-4000-8000-000000000000", "p1")).toEqual({
      ok: false,
      error: "table-not-found",
    });
  });

  it("a player who left can no longer act at that table", async () => {
    const { service, table } = await startedTable();
    const left = expectTable(await service.leaveTable(table.id, "p2"));
    const version = left.match?.version ?? 0;
    expect(await service.act(table.id, "p2", version, { type: "pass" })).toEqual({ ok: false, error: "not-seated" });
  });
});

describe("getCurrentTable", () => {
  it("is the latest table the player has not left, so an old finished table never comes back", async () => {
    const { service, table } = await startedTable();
    await service.leaveTable(table.id, "p2");
    await service.leaveTable(table.id, "p1");
    const next = expectTable(await service.quickMatch("p1", "Ana", "1v1"));
    expect((await service.getCurrentTable("p1"))?.id).toBe(next.id);
  });

  it("starting a new table closes out the previous finished one", async () => {
    const { service, table } = await startedTable();
    await service.leaveTable(table.id, "p2");
    const next = expectTable(await service.quickMatch("p1", "Ana", "1v1"));
    expect(next.id).not.toBe(table.id);
    expect((await service.getCurrentTable("p1"))?.id).toBe(next.id);
  });
});

describe("act", () => {
  it("rejects players not seated at the table", async () => {
    const { service, table, match } = await startedTable();
    expect(await service.act(table.id, "p3", match.version, { type: "pass" })).toEqual({ ok: false, error: "not-seated" });
  });

  it("rejects actions before the match starts", async () => {
    const service = makeService();
    const table = expectTable(await service.createPrivateTable("p1", "Ana"));
    expect(await service.act(table.id, "p1", 1, { type: "pass" })).toEqual({ ok: false, error: "not-started" });
  });

  it("passes engine rule errors through", async () => {
    const { service, table, match } = await startedTable();
    const waiting = match.hand.turn === 0 ? "p2" : "p1";
    expect(await service.act(table.id, waiting, match.version, { type: "pass" })).toEqual({
      ok: false,
      error: "not-your-turn",
    });
  });

  it("applies a double-submitted move only once", async () => {
    const { service, table, match } = await startedTable();
    const opener = match.hand.turn === 0 ? "p1" : "p2";
    const tileId = match.hand.forcedOpeningTileId;
    if (tileId === null) throw new Error("demo rules force an opening tile");
    const move = { type: "play", tileId, end: "left" } as const;

    const [first, second] = await Promise.all([
      service.act(table.id, opener, match.version, move),
      service.act(table.id, opener, match.version, move),
    ]);
    expect(expectTable(first).match?.version).toBe(match.version + 1);
    expect(second).toEqual({ ok: false, error: "stale-version" });
  });
});

describe("setPresence", () => {
  it("updates the seat at the current table and reports only real changes", async () => {
    const { service } = await startedTable();
    const changed = await service.setPresence("p1", false);
    expect(changed?.seats[0]?.connected).toBe(false);
    expect(await service.setPresence("p1", false)).toBeNull();
  });

  it("ignores tables the player left", async () => {
    const { service, table } = await startedTable();
    await service.leaveTable(table.id, "p2");
    expect(await service.setPresence("p2", false)).toBeNull();
  });
});

describe("turn timer", () => {
  const SECONDS = DEMO_RULES_BY_MODE["1v1"].turnSeconds * 1000;

  it("starts the clock when the match starts, restarts it on every action, stops it at the end", async () => {
    const { service, table, match } = await startedTable();
    expect(table.turnDeadline).toBe(clock.ms + SECONDS);
    clock.ms += 4000;
    const opener = match.hand.turn === 0 ? "p1" : "p2";
    const tileId = match.hand.forcedOpeningTileId;
    if (tileId === null) throw new Error("demo rules force an opening tile");
    const moved = expectTable(await service.act(table.id, opener, match.version, { type: "play", tileId, end: "left" }));
    expect(moved.turnDeadline).toBe(clock.ms + SECONDS);
    const left = expectTable(await service.leaveTable(table.id, "p2"));
    expect(left.turnDeadline).toBeNull();
  });

  it("does nothing before the deadline or for a turn that already moved on", async () => {
    const { service, table, match } = await startedTable();
    clock.ms += SECONDS - 1;
    expect(await service.expireTurn(table.id, match.version)).toBeNull();
    clock.ms += 1;
    expect(await service.expireTurn(table.id, match.version + 7)).toBeNull();
  });

  it("passes the turn at the deadline, and a second timeout in a row loses the match", async () => {
    const { service, table, match } = await startedTable();
    const late = match.hand.turn;
    clock.ms += SECONDS;
    const passed = await service.expireTurn(table.id, match.version);
    if (passed === null || passed.match === null) throw new Error("expected a timeout");
    expect(passed.match.hand.turn).toBe(1 - late);
    expect(passed.match.timeoutStrikes[late]).toBe(1);
    expect(passed.turnDeadline).toBe(clock.ms + SECONDS);
    // The other player times out too, then the first one again: that is two in a row for the first.
    clock.ms += SECONDS;
    const back = await service.expireTurn(table.id, passed.match.version);
    if (back === null || back.match === null) throw new Error("expected a timeout");
    clock.ms += SECONDS;
    const lost = await service.expireTurn(table.id, back.match.version);
    if (lost === null || lost.match === null) throw new Error("expected a timeout");
    expect(lost.match).toMatchObject({ phase: "finished", winner: 1 - late });
    expect(lost.match.hand.result?.kind).toBe("timeout");
    expect(lost.turnDeadline).toBeNull();
  });

  it("applies a timeout only once even if the expiry fires twice", async () => {
    const { service, table, match } = await startedTable();
    clock.ms += SECONDS;
    const [first, second] = await Promise.all([service.expireTurn(table.id, match.version), service.expireTurn(table.id, match.version)]);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});
