import { viewFor } from "@dominio/engine";
import type { TableView } from "@dominio/protocol";
import type { Table } from "./table.ts";

export function buildTableView(table: Table, seat: number, serverNow: number): TableView {
  return {
    tableId: table.id,
    code: table.code,
    visibility: table.visibility,
    mode: table.mode,
    yourSeat: seat,
    seats: table.seats.map((s) => (s === null ? null : { nickname: s.nickname, connected: s.connected })),
    game: table.match === null ? null : viewFor(table.match, seat),
    turnDeadline: table.turnDeadline,
    serverNow,
  };
}
