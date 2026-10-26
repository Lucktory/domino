import type { Action } from "@dominio/engine";
import type { ClientToServerEvents, ServerToClientEvents, SessionInfo, TableView } from "@dominio/protocol";
import { io as connectClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { DEMO_RULES_BY_MODE } from "@dominio/protocol";
import type { Logger } from "./lib/logger.ts";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface Client {
  socket: ClientSocket;
  session: SessionInfo;
  /** Every table:state payload received, in order. */
  states: TableView[];
  /** Every table:current payload received, in order. */
  currents: (TableView | null)[];
}

const loggedErrors: unknown[] = [];
const testLogger: Logger = {
  info: () => undefined,
  error: (message, fields) => loggedErrors.push({ message, fields }),
};

let app: ReturnType<typeof createApp>;
let url: string;
const clients: ClientSocket[] = [];

beforeEach(async () => {
  loggedErrors.length = 0;
  app = createApp({ rulesByMode: DEMO_RULES_BY_MODE, sessionSecret: "s".repeat(32), webOrigins: ["http://localhost"], logger: testLogger });
  await new Promise<void>((resolve) => app.httpServer.listen(0, resolve));
  const address = app.httpServer.address();
  if (address === null || typeof address === "string") throw new Error("server has no port");
  url = `http://localhost:${address.port}`;
});

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  await app.close();
  expect(loggedErrors).toEqual([]);
});

function connect(token?: string, target = url): Promise<Client> {
  const socket: ClientSocket = connectClient(target, {
    auth: token === undefined ? {} : { token },
    transports: ["websocket"],
    forceNew: true,
  });
  clients.push(socket);
  const states: TableView[] = [];
  const currents: (TableView | null)[] = [];
  socket.on("table:state", (state) => states.push(state));
  socket.on("table:current", (current) => currents.push(current));
  return new Promise((resolve, reject) => {
    socket.once("session", (session) => { resolve({ socket, session, states, currents }); });
    socket.once("connect_error", reject);
  });
}

function latest(client: Client): TableView | undefined {
  return client.states.at(-1);
}

async function waitFor(client: Client, predicate: (view: TableView) => boolean): Promise<TableView> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const view = latest(client);
    if (view !== undefined && predicate(view)) return view;
    if (Date.now() > deadline) throw new Error("timed out waiting for table state");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function startTable(target = url): Promise<{ host: Client; guest: Client; tableId: string }> {
  const host = await connect(undefined, target);
  const guest = await connect(undefined, target);
  const created = await host.socket.emitWithAck("table:create", { nickname: "Ana" });
  if (!created.ok) throw new Error(created.error);
  const joined = await guest.socket.emitWithAck("table:join", { code: created.data.code.toLowerCase(), nickname: "Beto" });
  if (!joined.ok) throw new Error(joined.error);
  await waitFor(host, (v) => v.game !== null);
  await waitFor(guest, (v) => v.game !== null);
  return { host, guest, tableId: created.data.tableId };
}

/** The table:current the server sent after the connection (exactly one per connection). */
async function currentOf(client: Client): Promise<TableView | null> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const [first] = client.currents;
    if (first !== undefined) return first;
    if (Date.now() > deadline) throw new Error("timed out waiting for table:current");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function chooseAction(view: TableView): Action {
  const game = view.game;
  if (game === null) throw new Error("no game");
  const move = game.legalMoves[0];
  if (move !== undefined) return { type: "play", ...move };
  if (game.canDraw) return { type: "draw" };
  if (game.canPass) return { type: "pass" };
  throw new Error("current seat has no action");
}

/** None of `owner`'s tiles appear anywhere in what `other` received. */
function expectNoLeak(owner: TableView, other: TableView): void {
  const json = JSON.stringify(other);
  for (const tile of owner.game?.hand ?? []) expect(json).not.toContain(`"${tile.id}"`);
}

describe("socket app", () => {
  it("answers health checks", async () => {
    const response = await fetch(`${url}/health`);
    expect(await response.text()).toBe("ok");
  });

  it("plays a full 1 vs 1 match without leaking hidden tiles", async () => {
    const { host, guest, tableId } = await startTable();
    const players = [host, guest];

    for (let step = 0; step < 200; step++) {
      const hostView = await waitFor(host, (v) => v.game !== null);
      const guestView = await waitFor(guest, (v) => v.game?.version === hostView.game?.version);
      const game = hostView.game;
      if (game === null || game.phase === "finished") break;

      expectNoLeak(hostView, guestView);
      expectNoLeak(guestView, hostView);

      const current = players.find((p) => latest(p)?.yourSeat === game.turn);
      if (current === undefined) throw new Error("no current player");
      const view = await waitFor(current, (v) => v.game?.version === game.version);
      const result = await current.socket.emitWithAck("game:action", {
        tableId,
        expectedVersion: game.version,
        action: chooseAction(view),
      });
      expect(result).toEqual({ ok: true, data: null });
      await waitFor(host, (v) => (v.game?.version ?? 0) > game.version);
    }

    const final = await waitFor(guest, (v) => v.game?.phase === "finished");
    expect(final.game?.revealedHands).toHaveLength(2);
    expect(final.game?.handResult).not.toBeNull();
  });

  it("rejects malformed input and stale versions", async () => {
    const { host, guest, tableId } = await startTable();
    expect(await host.socket.emitWithAck("table:join", { code: "nope", nickname: "" })).toEqual({
      ok: false,
      error: "invalid-input",
    });

    const view = latest(host)?.game;
    if (view === undefined || view === null) throw new Error("no game");
    const current = latest(host)?.yourSeat === view.turn ? host : guest;
    const action = chooseAction(await waitFor(current, (v) => v.game?.version === view.version));
    const stale = await current.socket.emitWithAck("game:action", { tableId, expectedVersion: view.version + 5, action });
    expect(stale).toEqual({ ok: false, error: "stale-version" });
  });

  it("gives a reconnecting player their seat and view back", async () => {
    const { host, guest, tableId } = await startTable();
    const hand = latest(guest)?.game?.hand;
    guest.socket.disconnect();
    await waitFor(host, (v) => v.seats[1]?.connected === false);

    const back = await connect(guest.session.token);
    expect(back.session.playerId).toBe(guest.session.playerId);
    const restored = await currentOf(back);
    expect(restored?.tableId).toBe(tableId);
    expect(restored?.game?.hand).toEqual(hand);
    await waitFor(host, (v) => v.seats[1]?.connected === true);
  });

  it("treats a forged token as a new guest", async () => {
    const { guest } = await startTable();
    const forged = await connect(guest.session.token.replace(/.$/, (c) => (c === "A" ? "B" : "A")));
    expect(forged.session.playerId).not.toBe(guest.session.playerId);
    expect(await currentOf(forged)).toBeNull();
    expect(forged.states).toEqual([]);
  });

  it("a fresh guest has no current table", async () => {
    expect(await currentOf(await connect())).toBeNull();
  });

  it("quick match pairs two players into one public table", async () => {
    const ana = await connect();
    const beto = await connect();
    const first = await ana.socket.emitWithAck("match:quick", { nickname: "Ana", mode: "1v1" });
    if (!first.ok) throw new Error(first.error);
    expect(first.data).toMatchObject({ visibility: "public", game: null });
    const second = await beto.socket.emitWithAck("match:quick", { nickname: "Beto", mode: "1v1" });
    if (!second.ok) throw new Error(second.error);
    expect(second.data.tableId).toBe(first.data.tableId);
    await waitFor(ana, (v) => v.game?.phase === "playing");
  });

  it("2 vs 2: four players get one pairs table, each sees only their own tiles, and a leaver's team loses", async () => {
    const players = [await connect(), await connect(), await connect(), await connect()];
    for (const [i, player] of players.entries()) {
      const joined = await player.socket.emitWithAck("match:quick", { nickname: `P${i}`, mode: "2v2" });
      if (!joined.ok) throw new Error(joined.error);
      expect(joined.data.mode).toBe("2v2");
    }
    const views = await Promise.all(players.map((p) => waitFor(p, (v) => v.game?.phase === "playing")));
    expect(new Set(views.map((v) => v.tableId)).size).toBe(1);
    expect(views.map((v) => v.yourSeat).sort()).toEqual([0, 1, 2, 3]);
    for (const view of views) {
      expect(view.game?.hand).toHaveLength(7);
      expect(view.game?.revealedHands).toBeNull();
      expect(view.game?.rules.teams).toBe("pairs");
    }

    const leaver = players[1];
    if (leaver === undefined) throw new Error("no player 1");
    const leaverSeat = views[1]?.yourSeat;
    if (leaverSeat === undefined) throw new Error("no seat for player 1");
    const tableId = views[0]?.tableId;
    if (tableId === undefined) throw new Error("no table");
    expect(await leaver.socket.emitWithAck("table:leave", { tableId })).toEqual({ ok: true, data: null });
    const partnerIndex = views.findIndex((v) => v.yourSeat === (leaverSeat + 2) % 4);
    const partner = players[partnerIndex];
    if (partner === undefined) throw new Error("no partner");
    const finished = await waitFor(partner, (v) => v.game?.phase === "finished");
    expect(finished.game?.handResult?.kind).toBe("forfeit");
    expect(finished.game?.matchWinner).toBe((leaverSeat + 1) % 2);
  });

  it("leaving a live match forfeits it, and the leaver's table is gone on reconnect", async () => {
    const { host, guest, tableId } = await startTable();
    expect(await guest.socket.emitWithAck("table:leave", { tableId })).toEqual({ ok: true, data: null });
    const hostView = await waitFor(host, (v) => v.game?.phase === "finished");
    expect(hostView.game?.handResult?.kind).toBe("forfeit");
    expect(hostView.game?.matchWinner).toBe(hostView.yourSeat);

    guest.socket.disconnect();
    const back = await connect(guest.session.token);
    expect(await currentOf(back)).toBeNull();
  });

  it("reconnecting shows the live match, never an older table the player left", async () => {
    const { host, guest, tableId } = await startTable();
    await guest.socket.emitWithAck("table:leave", { tableId });
    await host.socket.emitWithAck("table:leave", { tableId });
    const searching = await host.socket.emitWithAck("match:quick", { nickname: "Ana", mode: "1v1" });
    if (!searching.ok) throw new Error(searching.error);
    const rival = await connect();
    await rival.socket.emitWithAck("match:quick", { nickname: "Caro", mode: "1v1" });

    host.socket.disconnect();
    const back = await connect(host.session.token);
    const current = await currentOf(back);
    expect(current?.tableId).toBe(searching.data.tableId);
    expect(current?.game?.phase).toBe("playing");
  });

  it("a player who left receives no more updates from that table", async () => {
    const { host, guest, tableId } = await startTable();
    await guest.socket.emitWithAck("table:leave", { tableId });
    const before = guest.states.length;
    host.socket.disconnect();
    await connect(host.session.token);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(guest.states.length).toBe(before);
  });
});

describe("turn timer over sockets", () => {
  it("passes the turn when time runs out, and two timeouts in a row lose the match", async () => {
    const fast = createApp({
      rulesByMode: { ...DEMO_RULES_BY_MODE, "1v1": { ...DEMO_RULES_BY_MODE["1v1"], turnSeconds: 0.3 } },
      sessionSecret: "s".repeat(32),
      webOrigins: ["http://localhost"],
      logger: testLogger,
    });
    await new Promise<void>((resolve) => fast.httpServer.listen(0, resolve));
    const address = fast.httpServer.address();
    if (address === null || typeof address === "string") throw new Error("server has no port");
    try {
      const { host } = await startTable(`http://localhost:${address.port}`);
      const start = await waitFor(host, (v) => v.game !== null);
      if (start.game === null || start.turnDeadline === null) throw new Error("no clock");
      expect(start.turnDeadline - start.serverNow).toBeGreaterThan(200);
      const late = start.game.turn;

      // Nobody moves: the clock passes the turn, then passes it back, then the first seat loses.
      const passed = await waitFor(host, (v) => v.game?.turn === 1 - late);
      expect(passed.game?.timeoutStrikes[late]).toBe(1);
      const finished = await waitFor(host, (v) => v.game?.phase === "finished");
      expect(finished.game?.handResult).toMatchObject({ kind: "timeout", winner: 1 - late, points: 0 });
      expect(finished.turnDeadline).toBeNull();
    } finally {
      await fast.close();
    }
  });
});
