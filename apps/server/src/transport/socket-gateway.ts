import { randomUUID } from "node:crypto";
import {
  gameActionInputSchema,
  joinTableInputSchema,
  leaveTableInputSchema,
  playerNameInputSchema,
  quickMatchInputSchema,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type TableView,
} from "@dominio/protocol";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import type { SessionTokens } from "../features/sessions/index.ts";
import { buildTableView, createTurnClock, findSeat, type Table, type TableResult, type TableService } from "../features/tables/index.ts";
import type { Logger } from "../lib/logger.ts";

interface SocketData {
  playerId: string;
  token: string;
}

export type GatewayServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GatewaySocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface GatewayDeps {
  readonly tables: TableService;
  readonly sessions: SessionTokens;
  readonly logger: Logger;
  /** Server clock (ms); sent with every view so phones can show the turn countdown. */
  readonly now: () => number;
}

const handshakeAuthSchema = z.object({ token: z.string().optional() });

/** All sockets of one player (several tabs, or a reconnect overlapping the old socket). */
function playerRoom(playerId: string): string {
  return `player:${playerId}`;
}

/** Socket.IO types the ack, but a client can omit it; check at runtime. */
function isAckCallback<T>(value: unknown): value is (result: Ack<T>) => void {
  return typeof value === "function";
}

/**
 * Thin transport layer: validate input, call the tables service, send views.
 * No game or table rules live here.
 */
export function attachSocketGateway(io: GatewayServer, deps: GatewayDeps): { stop: () => void } {
  const { tables, sessions, logger, now } = deps;

  // When a turn's time is up the service applies the timeout (if still due) and everyone gets the new state.
  const clock = createTurnClock((tableId, version) => {
    tables.expireTurn(tableId, version).then(
      (table) => {
        if (table !== null) broadcast(table);
      },
      (error: unknown) => {
        logger.error("turn timeout failed", { tableId, error });
      },
    );
  }, now);

  /**
   * Each seated player gets their own view; nobody receives another seat's tiles. Players who left get
   * nothing. Every change is broadcast, so this is also where the turn clock is kept in step.
   */
  function broadcast(table: Table): void {
    clock.track(table);
    table.seats.forEach((seat, index) => {
      if (seat !== null && !seat.left) io.to(playerRoom(seat.playerId)).emit("table:state", buildTableView(table, index, now()));
    });
  }

  function viewForPlayer(table: Table, playerId: string): TableView {
    const seat = findSeat(table, playerId);
    if (seat === null) throw new Error(`player ${playerId} not seated at table ${table.id}`);
    return buildTableView(table, seat, now());
  }

  io.use((socket, next) => {
    const auth = handshakeAuthSchema.safeParse(socket.handshake.auth);
    const presented = auth.success ? auth.data.token : undefined;
    const verified = presented === undefined ? null : sessions.verify(presented);
    if (presented !== undefined && verified !== null) {
      socket.data.playerId = verified;
      socket.data.token = presented;
    } else {
      // No token, or one this server did not sign: start a new guest identity.
      const playerId = randomUUID();
      socket.data.playerId = playerId;
      socket.data.token = sessions.issue(playerId);
    }
    next();
  });

  io.on("connection", (socket: GatewaySocket) => {
    const { playerId, token } = socket.data;
    const logFailure = (message: string, error: unknown) => {
      logger.error(message, { playerId, error });
    };

    void socket.join(playerRoom(playerId));
    socket.emit("session", { token, playerId });

    // table:current goes first so the client knows which single table (if any) to show.
    void (async () => {
      const current = await tables.getCurrentTable(playerId);
      socket.emit("table:current", current === null ? null : viewForPlayer(current, playerId));
      const changed = await tables.setPresence(playerId, true);
      if (changed !== null) broadcast(changed);
    })().catch((error: unknown) => {
      logFailure("restore on connect failed", error);
    });

    /** Validates payload and ack, runs the handler, and reports every failure to the caller. */
    function handle<S extends z.ZodType, T>(
      event: string,
      schema: S,
      payload: unknown,
      ack: unknown,
      run: (input: z.output<S>) => Promise<Ack<T>>,
    ): void {
      if (!isAckCallback<T>(ack)) {
        logger.info("event without ack ignored", { playerId, event });
        return;
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "invalid-input" });
        return;
      }
      run(parsed.data).then(ack, (error: unknown) => {
        logFailure(`${event} failed`, error);
        ack({ ok: false, error: "internal" });
      });
    }

    /** Sends the new state to everyone still at the table, then replies with this player's view. */
    const replyWithView = (result: TableResult): Ack<TableView> => {
      if (!result.ok) return result;
      broadcast(result.table);
      return { ok: true, data: viewForPlayer(result.table, playerId) };
    };
    const replyDone = (result: TableResult): Ack<null> => {
      if (!result.ok) return result;
      broadcast(result.table);
      return { ok: true, data: null };
    };

    socket.on("table:create", (payload, ack) => {
      handle("table:create", playerNameInputSchema, payload, ack, async (input) =>
        replyWithView(await tables.createPrivateTable(playerId, input.nickname)),
      );
    });

    socket.on("match:quick", (payload, ack) => {
      handle("match:quick", quickMatchInputSchema, payload, ack, async (input) =>
        replyWithView(await tables.quickMatch(playerId, input.nickname, input.mode)),
      );
    });

    socket.on("table:join", (payload, ack) => {
      handle("table:join", joinTableInputSchema, payload, ack, async (input) =>
        replyWithView(await tables.joinTable(input.code, playerId, input.nickname)),
      );
    });

    socket.on("table:leave", (payload, ack) => {
      handle("table:leave", leaveTableInputSchema, payload, ack, async (input) =>
        replyDone(await tables.leaveTable(input.tableId, playerId)),
      );
    });

    socket.on("game:action", (payload, ack) => {
      handle("game:action", gameActionInputSchema, payload, ack, async (input) =>
        replyDone(await tables.act(input.tableId, playerId, input.expectedVersion, input.action)),
      );
    });

    socket.on("disconnect", () => {
      void (async () => {
        const remaining = await io.in(playerRoom(playerId)).fetchSockets();
        if (remaining.length > 0) return;
        const changed = await tables.setPresence(playerId, false);
        if (changed !== null) broadcast(changed);
      })().catch((error: unknown) => {
        logFailure("presence update on disconnect failed", error);
      });
    });
  });

  return { stop: () => { clock.stopAll(); } };
}
