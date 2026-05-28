/**
 * Watchlist-export CLI launcher. Bundles scripts/export_watchlist/main.ts
 * via esbuild for Node 20 and runs it as a child process so the existing
 * src/lib TypeScript modules can be imported without a separate build
 * step.
 *
 * Usage:
 *
 *   node scripts/export_watchlist.mjs \
 *     [--watchlist=id1,id2,...] \
 *     [--scenarios=id1,id2,...] \
 *     [--format=json|markdown] \
 *     [--output=path] \
 *     [--no-emit-evidence]
 *
 * Defaults: watchlist=nvidia,tsmc,asml,sk-hynix; scenarios none;
 * format=json; output=ops/exports/chip-watchlist-risk-packet.json;
 * evidence emission ON.
 *
 * Mirrors scripts/run_ts_tests.mjs in shape and dependencies.
 */
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = resolve(root, "node_modules/.tmp/export-watchlist");
const entry = resolve(root, "scripts/export_watchlist/main.ts");
const outfile = resolve(outdir, "main.mjs");

await mkdir(outdir, { recursive: true });

await build({
  bundle: true,
  entryPoints: [entry],
  format: "esm",
  logLevel: "silent",
  outfile,
  platform: "node",
  sourcemap: "inline",
  target: "node20"
});

const result = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
