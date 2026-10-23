import type { Table } from "./table.ts";

export interface TurnClock {
  /** Schedules (or cancels) the timeout for this table's current turn. Call after every save. */
  track(table: Table): void;
  stopAll(): void;
}

/**
 * One pending timer per table, for its current turn. When it fires, onDue gets the match version it
 * was set for; the service ignores it if the turn has moved on (stale-safe). In-process only: with
 * several server instances each table must be owned by one instance.
 */
export function createTurnClock(onDue: (tableId: string, version: number) => void, now: () => number = Date.now): TurnClock {
  const pending = new Map<string, { version: number; deadline: number; handle: ReturnType<typeof setTimeout> }>();

  const cancel = (tableId: string) => {
    const entry = pending.get(tableId);
    if (entry === undefined) return;
    clearTimeout(entry.handle);
    pending.delete(tableId);
  };

  return {
    track(table) {
      const { match, turnDeadline } = table;
      if (match === null || turnDeadline === null) {
        cancel(table.id);
        return;
      }
      const current = pending.get(table.id);
      if (current?.version === match.version && current.deadline === turnDeadline) return;
      cancel(table.id);
      const version = match.version;
      const fire = () => {
        const entry = pending.get(table.id);
        if (entry === undefined) throw new Error(`turn timer fired for table ${table.id} after it was cancelled`);
        // The service decides "due" with the same clock. If that clock is behind the timer (e.g. the system
        // clock was adjusted), asking now would be ignored and nothing would ask again: wait out the rest.
        const left = turnDeadline - now();
        if (left > 0) {
          entry.handle = setTimeout(fire, left);
          return;
        }
        pending.delete(table.id);
        onDue(table.id, version);
      };
      pending.set(table.id, { version, deadline: turnDeadline, handle: setTimeout(fire, Math.max(0, turnDeadline - now())) });
    },
    stopAll() {
      for (const tableId of [...pending.keys()]) cancel(tableId);
    },
  };
}
