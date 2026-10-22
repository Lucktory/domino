/**
 * Runs tasks for the same key one at a time, in arrival order, so two moves at the same
 * table can never interleave. In-process only: with several server instances, each table
 * must be owned by one instance.
 */
export interface TableQueue {
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
}

export function createTableQueue(): TableQueue {
  const tails = new Map<string, Promise<unknown>>();
  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      // A failed task rejects only its own caller; the next task still runs.
      const current = previous.then(task, task);
      tails.set(key, current);
      const cleanup = () => {
        if (tails.get(key) === current) tails.delete(key);
      };
      current.then(cleanup, cleanup);
      return current;
    },
  };
}
