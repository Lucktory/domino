import { createApp } from "./app.ts";
import { DEMO_RULES_BY_MODE } from "@dominio/protocol";
import { loadEnv } from "./lib/env.ts";
import { createLogger } from "./lib/logger.ts";

const logger = createLogger();
const env = loadEnv(process.env);
const app = createApp({
  rulesByMode: DEMO_RULES_BY_MODE,
  sessionSecret: env.SESSION_SECRET,
  webOrigins: env.WEB_ORIGINS,
  logger,
});

app.httpServer.listen(env.PORT, () => {
  logger.info("server listening", { port: env.PORT, nodeEnv: env.NODE_ENV });
});

process.on("SIGTERM", () => {
  logger.info("shutting down");
  app.close().catch((error: unknown) => {
    logger.error("shutdown failed", { error });
    process.exitCode = 1;
  });
});
