// Fails when source or config files contain non-ASCII characters (project rule: code, comments
// and strings are ASCII; UI text uses \u escapes). Markdown docs are not checked.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SCAN = ["packages", "apps", "scripts"];
const ROOT_FILES = ["eslint.config.js", "vitest.config.ts", "knip.json", "package.json", "tsconfig.base.json", ".jscpd.json"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".json", ".svg"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "dev-dist", "coverage"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(path);
    } else if (EXTENSIONS.has(extname(name))) {
      yield path;
    }
  }
}

const files = [...SCAN.flatMap((dir) => [...walk(join(ROOT, dir))]), ...ROOT_FILES.map((f) => join(ROOT, f))];
const problems = [];
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const col = line.search(/[^\x00-\x7F]/);
      if (col >= 0) problems.push(`${relative(ROOT, file)}:${i + 1}:${col + 1}  ${JSON.stringify(line.trim().slice(0, 80))}`);
    });
}

if (problems.length > 0) {
  console.error(`Non-ASCII characters found (use \\u escapes in strings):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`ASCII check passed (${files.length} files).`);
