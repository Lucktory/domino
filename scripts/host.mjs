// Hosts the demo from this computer: the game server plus a free Cloudflare quick tunnel that gives it a
// public https address. The web app is on Vercel and is built with that address, so whenever the tunnel's
// address changes it is written to apps/web/.env.production, committed (that file only) and pushed, and
// Vercel rebuilds the site with it. Usage: pnpm host. Stop with Ctrl+C.
//
// Pushes only when main is the current branch and has no other unpushed commits, so it never publishes
// work that was not reviewed. Needs cloudflared on the PATH (winget install Cloudflare.cloudflared).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SERVER_DIR = join(ROOT, "apps", "server");
const ADDRESS_FILE = "apps/web/.env.production";
const PRODUCTION_BRANCH = "main";
const TUNNEL_ADDRESS = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
/** A new quick-tunnel name can take a little while to resolve; give it this long before trying a new tunnel. */
const TUNNEL_READY_MS = 90_000;
const TUNNEL_RESTART_DELAY_MS = 5_000;

function log(message) {
  console.log(`[host] ${message}`);
}

function fail(message) {
  console.error(`[host] ${message}`);
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function serverPort() {
  const file = join(SERVER_DIR, ".env");
  if (!existsSync(file)) fail("apps/server/.env is missing. Copy apps/server/.env.example to apps/server/.env and fill it in.");
  const port = parseEnv(readFileSync(file, "utf8")).PORT;
  if (port === undefined || !/^\d+$/.test(port)) fail("PORT is missing or not a number in apps/server/.env.");
  return Number(port);
}

/** Polls a /health URL until it answers "ok" or the time runs out. */
async function waitForHealth(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5_000) });
      if (response.ok && (await response.text()) === "ok") return true;
    } catch {
      // Not reachable yet (server starting, or the tunnel name not resolving yet): try again.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}

/** Writes, commits and pushes the new address. Returns false (and says why) when it must not push. */
function publish(address) {
  const content =
    "# Written by `pnpm host` (scripts/host.mjs): the public address of the game server on the host computer\n" +
    "# (Cloudflare quick tunnel). Vercel builds the site with it. Do not edit by hand.\n" +
    `VITE_SERVER_URL=${address}\n`;
  const path = join(ROOT, ADDRESS_FILE);
  if (existsSync(path) && readFileSync(path, "utf8") === content && git("status", "--porcelain", "--", ADDRESS_FILE) === "") {
    log("The address is unchanged; the site already uses it.");
    return true;
  }

  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== PRODUCTION_BRANCH) {
    log(`Not publishing: the current branch is "${branch}", but Vercel builds the site from "${PRODUCTION_BRANCH}".`);
    return false;
  }
  let unpushed;
  try {
    unpushed = Number(git("rev-list", "--count", "@{u}..HEAD"));
  } catch {
    log(`Not publishing: "${PRODUCTION_BRANCH}" has no upstream. Push it once with: git push -u origin ${PRODUCTION_BRANCH}`);
    return false;
  }
  if (unpushed > 0) {
    log(`Not publishing: "${PRODUCTION_BRANCH}" has ${unpushed} commit(s) that are not pushed yet. Review and push them, then restart pnpm host.`);
    return false;
  }

  writeFileSync(path, content);
  git("add", "--", ADDRESS_FILE);
  git("commit", "-m", "chore: update server address", "--", ADDRESS_FILE);
  try {
    git("push");
  } catch (error) {
    const detail = error instanceof Error && "stderr" in error ? String(error.stderr).trim() : String(error);
    log(`The address was committed but the push failed:\n${detail}\nFix it (for example git pull --rebase), then run: git push`);
    return false;
  }
  log("New address pushed. Vercel is rebuilding the site; it uses the new address in about a minute.");
  return true;
}

const port = serverPort();
const children = new Set();
let stopping = false;

function stopAll(code) {
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 1_000);
}
process.on("SIGINT", () => {
  log("Stopping the server and the tunnel.");
  stopAll(0);
});

// 1. The game server, with the settings in apps/server/.env.
const server = spawn(process.execPath, ["--env-file=.env", "src/main.ts"], { cwd: SERVER_DIR, stdio: "inherit" });
children.add(server);
server.on("exit", (code) => {
  children.delete(server);
  if (!stopping) {
    log(`The game server stopped (exit code ${code}). Stopping the tunnel too.`);
    stopAll(1);
  }
});
if (!(await waitForHealth(`http://localhost:${port}`, 20_000))) {
  log(`The game server did not answer on port ${port}.`);
  stopAll(1);
} else {
  log(`Game server running on port ${port}.`);
  startTunnel();
}

// 2. The tunnel. Each new tunnel gets a new address, which is published once it answers.
function startTunnel() {
  if (stopping) return;
  const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(tunnel);
  let found = false;
  const onOutput = (chunk) => {
    const text = String(chunk);
    for (const line of text.split("\n")) if (line.includes(" ERR ")) console.error(`[tunnel] ${line.trim()}`);
    const match = TUNNEL_ADDRESS.exec(text);
    if (found || match === null) return;
    found = true;
    const address = match[0];
    log(`Tunnel address: ${address} (checking that it answers...)`);
    void waitForHealth(address, TUNNEL_READY_MS).then((ready) => {
      if (stopping) return;
      if (!ready) {
        log("The tunnel address did not answer in time; starting a new tunnel.");
        tunnel.kill();
        return;
      }
      publish(address);
      log("Running. Keep this window open and the computer awake. Press Ctrl+C to stop.");
    });
  };
  tunnel.stdout.on("data", onOutput);
  tunnel.stderr.on("data", onOutput);
  tunnel.on("error", (error) => {
    if ("code" in error && error.code === "ENOENT") {
      log("cloudflared is not installed. Install it with: winget install Cloudflare.cloudflared (then open a new terminal).");
    } else {
      log(`Could not start cloudflared: ${error.message}`);
    }
    stopAll(1);
  });
  tunnel.on("exit", () => {
    children.delete(tunnel);
    if (stopping) return;
    log(`The tunnel stopped; starting a new one in ${TUNNEL_RESTART_DELAY_MS / 1000} s.`);
    setTimeout(startTunnel, TUNNEL_RESTART_DELAY_MS);
  });
}
