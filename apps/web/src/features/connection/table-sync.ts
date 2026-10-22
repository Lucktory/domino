import type { TableView } from "@dominio/protocol";

/**
 * A table:state broadcast only updates the table already on screen, and never with older data.
 * Tables are adopted only from table:current or from the reply to the player's own request.
 */
export function applyTableUpdate(current: TableView | null, incoming: TableView): TableView | null {
  if (current === null || current.tableId !== incoming.tableId) return current;
  if (current.game !== null && incoming.game === null) return current;
  if (current.game !== null && incoming.game !== null && incoming.game.version < current.game.version) return current;
  return incoming;
}

/** The reply to create/join/quick switches to that table, unless a newer state of it is already shown. */
export function adoptTable(current: TableView | null, incoming: TableView): TableView {
  if (current === null || current.tableId !== incoming.tableId) return incoming;
  return applyTableUpdate(current, incoming) ?? incoming;
}
