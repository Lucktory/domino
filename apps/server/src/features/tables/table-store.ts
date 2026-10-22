import { isWaiting, type Table } from "./table.ts";

/**
 * Where tables live. Async so the in-memory demo store can be swapped for Redis
 * without changing callers.
 */
export interface TableStore {
  get(id: string): Promise<Table | null>;
  getByCode(code: string): Promise<Table | null>;
  save(table: Table): Promise<void>;
  /** Tables the player has ever sat at, oldest join first. */
  listByPlayer(playerId: string): Promise<Table[]>;
  /** Public tables waiting for players with a free seat, oldest first. */
  listOpenPublic(): Promise<Table[]>;
}

/**
 * Demo store: one process, lost on restart, never evicts. Not for real money.
 */
export function createInMemoryTableStore(): TableStore {
  const byId = new Map<string, Table>();
  const idByCode = new Map<string, string>();
  const idsByPlayer = new Map<string, string[]>();

  const getSync = (id: string): Table | null => byId.get(id) ?? null;

  return {
    get: (id) => Promise.resolve(getSync(id)),
    getByCode: (code) => {
      const id = idByCode.get(code);
      return Promise.resolve(id === undefined ? null : getSync(id));
    },
    save: (table) => {
      byId.set(table.id, table);
      idByCode.set(table.code, table.id);
      for (const seat of table.seats) {
        if (seat === null) continue;
        const ids = idsByPlayer.get(seat.playerId) ?? [];
        if (!ids.includes(table.id)) idsByPlayer.set(seat.playerId, [...ids, table.id]);
      }
      return Promise.resolve();
    },
    listByPlayer: (playerId) =>
      Promise.resolve(
        (idsByPlayer.get(playerId) ?? []).flatMap((id) => {
          const table = getSync(id);
          return table === null ? [] : [table];
        }),
      ),
    listOpenPublic: () =>
      Promise.resolve(
        [...byId.values()].filter((t) => t.visibility === "public" && isWaiting(t) && t.seats.includes(null)),
      ),
  };
}
