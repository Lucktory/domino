import { createServer, type Server as HttpServer } from "node:http";
import type { RuleSet } from "@dominio/engine";
import type { GameMode } from "@dominio/protocol";
import { Server } from "socket.io";
import { createSessionTokens } from "./features/sessions/index.ts";
import { createInMemoryTableStore, createTableQueue, createTableService } from "./features/tables/index.ts";
import { cryptoRng } from "./lib/crypto-rng.ts";
import type { Logger } from "./lib/logger.ts";
import { attachSocketGateway, type GatewayServer } from "./transport/socket-gateway.ts";

interface AppConfig {
  readonly rulesByMode: Readonly<Record<GameMode, RuleSet>>;
  readonly sessionSecret: string;
  readonly webOrigins: readonly string[];
  readonly logger: Logger;
}

interface App {
  readonly httpServer: HttpServer;
  close(): Promise<void>;
}

/** Wires the app together. Does not listen, so tests can pick their own port. */
export function createApp(config: AppConfig): App {
  const httpServer = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    res.writeHead(404).end();
  });

  // Heartbeat every 10 s, dead after 5 s more: a dropped phone shows as offline within ~15 s.
  const io: GatewayServer = new Server(httpServer, {
    cors: { origin: [...config.webOrigins] },
    pingInterval: 10_000,
    pingTimeout: 5_000,
  });
  const tables = createTableService({
    store: createInMemoryTableStore(),
    queue: createTableQueue(),
    rulesByMode: config.rulesByMode,
    rng: cryptoRng,
  });
  const gateway = attachSocketGateway(io, {
    tables,
    sessions: createSessionTokens(config.sessionSecret),
    logger: config.logger,
    now: Date.now,
  });

  return {
    httpServer,
    close: () => {
      gateway.stop();
      return io.close();
    },
  };
}
