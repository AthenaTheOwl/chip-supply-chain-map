import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = resolve(root, "node_modules/.tmp/ts-tests");
const entries = process.argv.slice(2);

if (entries.length === 0) {
  console.error("run_ts_tests: pass at least one TypeScript test file");
  process.exit(1);
}

await mkdir(outdir, { recursive: true });

for (const entry of entries) {
  const entryPath = resolve(root, entry);
  const outfile = resolve(outdir, `${basename(entry, ".ts")}.mjs`);

  await build({
    bundle: true,
    entryPoints: [entryPath],
    format: "esm",
    logLevel: "silent",
    outfile,
    platform: "node",
    sourcemap: "inline",
    target: "node20"
  });

  const result = spawnSync(process.execPath, [outfile], {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
