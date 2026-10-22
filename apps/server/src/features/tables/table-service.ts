import { randomUUID } from "node:crypto";
import { applyAction, createMatch, forfeitMatch, timeoutTurn, type Action, type MatchState, type Rng, type RuleSet } from "@dominio/engine";
import type { ErrorCode, GameMode } from "@dominio/protocol";
import { findSeat, isActiveSeatOf, isWaiting, type Seat, type Table, type TableVisibility } from "./table.ts";
import { generateTableCode } from "./table-code.ts";
import type { TableQueue } from "./table-queue.ts";
import type { TableStore } from "./table-store.ts";

export type TableResult = { readonly ok: true; readonly table: Table } | { readonly ok: false; readonly error: ErrorCode };

interface TableServiceDeps {
  readonly store: TableStore;
  readonly queue: TableQueue;
  /** Rules for each game mode; a table takes its mode's rules when it opens. */
  readonly rulesByMode: Readonly<Record<GameMode, RuleSet>>;
  readonly rng: Rng;
  /** Injectable so tests can force collisions. */
  readonly generateCode?: () => string;
  /** Server clock in ms; injectable so tests control time. */
  readonly now?: () => number;
}

const MAX_CODE_ATTEMPTS = 20;
/** All quick-match seating runs under this one key, so searching players meet instead of each opening a table. */
const MATCHMAKING_KEY = "matchmaking";

function playerKey(playerId: string): string {
  return `player:${playerId}`;
}

function newSeat(playerId: string, nickname: string): Seat {
  return { playerId, nickname, connected: true, left: false };
}

function updateSeat(table: Table, index: number, change: (seat: Seat) => Seat | null): Table {
  return { ...table, seats: table.seats.map((seat, i) => (i === index && seat !== null ? change(seat) : seat)) };
}

export type TableService = ReturnType<typeof createTableService>;

/**
 * A player has at most one active table: the latest one they sit at and have not left.
 * Lock order is always player -> matchmaking -> table, so tasks never wait on each other in a cycle.
 */
export function createTableService(deps: TableServiceDeps) {
  const { store, queue, rulesByMode, rng } = deps;
  const now = deps.now ?? Date.now;

  /** The table with this match and a fresh clock: every accepted action restarts the turn timer. */
  function withMatch(table: Table, match: MatchState | null): Table {
    const turnDeadline = match !== null && match.phase === "playing" ? now() + match.rules.turnSeconds * 1000 : null;
    return { ...table, match, turnDeadline };
  }
  const generateCode = deps.generateCode ?? generateTableCode;

  async function uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateCode();
      if ((await store.getByCode(code)) === null) return code;
    }
    throw new Error(`No free table code after ${MAX_CODE_ATTEMPTS} attempts`);
  }

  async function getCurrentTable(playerId: string): Promise<Table | null> {
    const active = (await store.listByPlayer(playerId)).filter((t) => isActiveSeatOf(t, playerId));
    return active.at(-1) ?? null;
  }

  async function openTable(playerId: string, nickname: string, visibility: TableVisibility, mode: GameMode): Promise<TableResult> {
    const rules = rulesByMode[mode];
    const seats: (Seat | null)[] = Array.from({ length: rules.seatCount }, () => null);
    seats[0] = newSeat(playerId, nickname);
    const table: Table = {
      id: randomUUID(),
      code: await uniqueCode(),
      visibility,
      mode,
      rules,
      seats,
      match: null,
      closed: false,
      turnDeadline: null,
    };
    await store.save(table);
    return { ok: true, table };
  }

  /** Runs the task in the table's queue with the player's seat, or fails if the table or seat is missing. */
  function withSeat(tableId: string, playerId: string, task: (table: Table, seat: number) => Promise<TableResult>): Promise<TableResult> {
    return queue.run(tableId, async () => {
      const table = await store.get(tableId);
      if (table === null) return { ok: false, error: "table-not-found" };
      const seat = findSeat(table, playerId);
      if (seat === null) return { ok: false, error: "not-seated" };
      return task(table, seat);
    });
  }

  /** Waiting table: frees the seat (closing the table when empty). Live match: forfeit. Finished: marks it left. */
  function leave(tableId: string, playerId: string): Promise<TableResult> {
    return withSeat(tableId, playerId, async (table, seat) => {
      if (table.seats[seat]?.left === true) return { ok: true, table };

      let updated: Table;
      if (table.match === null) {
        const freed = updateSeat(table, seat, () => null);
        updated = { ...freed, closed: freed.seats.every((s) => s === null) };
      } else if (table.match.phase === "finished") {
        updated = updateSeat(table, seat, (s) => ({ ...s, left: true }));
      } else {
        const result = forfeitMatch(table.match, seat);
        if (!result.ok) return { ok: false, error: result.error };
        updated = updateSeat(withMatch(table, result.state), seat, (s) => ({ ...s, left: true }));
      }
      await store.save(updated);
      return { ok: true, table: updated };
    });
  }

  /** Frees the player for another table. Refuses while they are in a live match. */
  async function releaseCurrent(playerId: string): Promise<ErrorCode | null> {
    const current = await getCurrentTable(playerId);
    if (current === null) return null;
    if (current.match !== null && current.match.phase !== "finished") return "already-playing";
    const result = await leave(current.id, playerId);
    return result.ok ? null : result.error;
  }

  /** Same table back, with the player's latest nickname. */
  function refreshNickname(tableId: string, playerId: string, nickname: string): Promise<TableResult> {
    return withSeat(tableId, playerId, async (table, seat) => {
      if (table.seats[seat]?.nickname === nickname) return { ok: true, table };
      const updated = updateSeat(table, seat, (s) => ({ ...s, nickname }));
      await store.save(updated);
      return { ok: true, table: updated };
    });
  }

  /** Takes the first free seat; the match starts when the table is full. */
  function seatInto(tableId: string, playerId: string, nickname: string): Promise<TableResult> {
    return queue.run(tableId, async () => {
      const table = await store.get(tableId);
      if (table === null || table.closed) return { ok: false, error: "table-not-found" };
      if (findSeat(table, playerId) !== null) return { ok: false, error: "table-full" };
      const emptySeat = table.seats.indexOf(null);
      if (emptySeat < 0) return { ok: false, error: "table-full" };

      const seats = table.seats.map((seat, i) => (i === emptySeat ? newSeat(playerId, nickname) : seat));
      const full = seats.every((seat) => seat !== null);
      const updated = withMatch({ ...table, seats }, full ? createMatch(table.rules, rng) : null);
      await store.save(updated);
      return { ok: true, table: updated };
    });
  }

  return {
    /** Private table joined by code (1 vs 1 for now). Idempotent while the player's private table is still waiting. */
    createPrivateTable(playerId: string, nickname: string): Promise<TableResult> {
      return queue.run(playerKey(playerId), async () => {
        const current = await getCurrentTable(playerId);
        if (current !== null && current.visibility === "private" && isWaiting(current)) {
          return refreshNickname(current.id, playerId, nickname);
        }
        const blocked = await releaseCurrent(playerId);
        if (blocked !== null) return { ok: false, error: blocked };
        return openTable(playerId, nickname, "private", "1v1");
      });
    },

    /**
     * Seats the player at the oldest public table of this mode still waiting for players, or opens one; the
     * match starts when it is full. Idempotent while searching in the same mode; searching in another mode
     * leaves the first search.
     */
    quickMatch(playerId: string, nickname: string, mode: GameMode): Promise<TableResult> {
      return queue.run(playerKey(playerId), () =>
        queue.run(MATCHMAKING_KEY, async () => {
          const current = await getCurrentTable(playerId);
          if (current !== null && current.visibility === "public" && current.mode === mode && isWaiting(current)) {
            return refreshNickname(current.id, playerId, nickname);
          }
          const blocked = await releaseCurrent(playerId);
          if (blocked !== null) return { ok: false, error: blocked };
          for (const open of (await store.listOpenPublic()).filter((t) => t.mode === mode)) {
            const joined = await seatInto(open.id, playerId, nickname);
            if (joined.ok) return joined;
          }
          return openTable(playerId, nickname, "public", mode);
        }),
      );
    },

    /** Joins by code. Joining the table you are already at returns it. */
    joinTable(code: string, playerId: string, nickname: string): Promise<TableResult> {
      return queue.run(playerKey(playerId), async () => {
        const target = await store.getByCode(code);
        if (target === null || target.closed) return { ok: false, error: "table-not-found" };
        const current = await getCurrentTable(playerId);
        if (current?.id === target.id) return refreshNickname(target.id, playerId, nickname);
        if (!target.seats.includes(null)) return { ok: false, error: "table-full" };
        const blocked = await releaseCurrent(playerId);
        if (blocked !== null) return { ok: false, error: blocked };
        return seatInto(target.id, playerId, nickname);
      });
    },

    leaveTable: leave,

    /** Applies a game action. `expectedVersion` makes retries and double taps harmless. */
    act(tableId: string, playerId: string, expectedVersion: number, action: Action): Promise<TableResult> {
      return withSeat(tableId, playerId, async (table, seat) => {
        if (table.seats[seat]?.left === true) return { ok: false, error: "not-seated" };
        if (table.match === null) return { ok: false, error: "not-started" };
        if (table.match.version !== expectedVersion) return { ok: false, error: "stale-version" };

        const result = applyAction(table.match, seat, action, rng);
        if (!result.ok) return { ok: false, error: result.error };
        const updated = withMatch(table, result.state);
        await store.save(updated);
        return { ok: true, table: updated };
      });
    },

    /** Marks the player connected or not at their current table. Returns the table if it changed. */
    async setPresence(playerId: string, connected: boolean): Promise<Table | null> {
      const current = await getCurrentTable(playerId);
      if (current === null) return null;
      return queue.run(current.id, async () => {
        const table = await store.get(current.id);
        if (table === null) return null;
        const seat = findSeat(table, playerId);
        if (seat === null || table.seats[seat]?.connected === connected) return null;
        const updated = updateSeat(table, seat, (s) => ({ ...s, connected }));
        await store.save(updated);
        return updated;
      });
    },

    /** The one table to show this player after (re)connecting, or null. */
    getCurrentTable,

    /**
     * Applies a timeout if the player to move is still on the same turn and past the deadline. A stale
     * call (someone moved meanwhile, or the clock was restarted) does nothing and returns null.
     */
    expireTurn(tableId: string, expectedVersion: number): Promise<Table | null> {
      return queue.run(tableId, async () => {
        const table = await store.get(tableId);
        if (table === null || table.match === null || table.turnDeadline === null) return null;
        if (table.match.version !== expectedVersion || now() < table.turnDeadline) return null;
        const result = timeoutTurn(table.match);
        if (!result.ok) throw new Error(`timeout failed at table ${tableId}: ${result.error}`);
        const updated = withMatch(table, result.state);
        await store.save(updated);
        return updated;
      });
    },
  };
}
