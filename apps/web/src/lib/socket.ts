import type { ClientToServerEvents, HandshakeAuth, ServerToClientEvents } from "@dominio/protocol";
import { io, type Socket } from "socket.io-client";
import { readStored, writeStored } from "./browser-storage.ts";
import { env } from "./env.ts";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = "dominio.sessionToken";

/** Socket that re-sends the stored guest token on every (re)connect, so the server restores the seat. */
export function createGameSocket(): GameSocket {
  const socket: GameSocket = io(env.serverUrl, {
    auth: (send) => {
      const token = readStored(TOKEN_KEY);
      const auth: HandshakeAuth = token === null ? {} : { token };
      send(auth);
    },
    transports: ["websocket"],
  });
  socket.on("session", (session) => {
    writeStored(TOKEN_KEY, session.token);
  });
  return socket;
}
