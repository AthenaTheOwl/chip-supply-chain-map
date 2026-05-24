/**
 * Hand-rolled smoke test for the history module.
 *
 * No vitest is wired up in this repo, so this file uses node-friendly
 * asserts and parses the CSV directly via fs (vite's `?raw` import
 * suffix only works inside the vite build, not in a plain node run).
 *
 * Run with:
 *   npx tsx src/lib/history.test.ts
 *
 * The intent is to lock the shape of the loader and the lookup
 * semantics against the seeded CSV so future edits to the CSV don't
 * silently break the slider.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv";

// Inlined so the test does not pull history.ts (which imports the CSV via
// vite's `?raw` suffix and breaks under plain node).
const QUARTERS = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"] as const;
type Quarter = (typeof QUARTERS)[number];
interface QuarterScores {
  chokepoint_score: number;
  geography_concentration: number;
  substitutability_penalty: number;
  lead_time_penalty: number;
  dependency_centrality: number;
  notes: string;
}
type HistoryByNode = Map<string, Map<Quarter, QuarterScores>>;

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(here, "../data/nodes_history.csv");
const csvText = readFileSync(csvPath, "utf-8");

function loadFromText(text: string): HistoryByNode {
  const rows = parseCsv(text);
  const byNode: HistoryByNode = new Map();
  for (const row of rows) {
    const id = row.id;
    const quarter = row.quarter as Quarter;
    if (!id || !QUARTERS.includes(quarter)) {
      continue;
    }
    const scores: QuarterScores = {
      chokepoint_score: Number(row.chokepoint_score),
      geography_concentration: Number(row.geography_concentration),
      substitutability_penalty: Number(row.substitutability_penalty),
      lead_time_penalty: Number(row.lead_time_penalty),
      dependency_centrality: Number(row.dependency_centrality),
      notes: row.notes
    };
    let nodeMap = byNode.get(id);
    if (!nodeMap) {
      nodeMap = new Map();
      byNode.set(id, nodeMap);
    }
    nodeMap.set(quarter, scores);
  }
  return byNode;
}

const history = loadFromText(csvText);

// 1. Coverage: every node covered by the seeded CSV has 4 quarterly rows.
assert.ok(
  history.size >= 50,
  `expected at least 50 nodes, got ${history.size}`
);
for (const [nodeId, quarters] of history) {
  assert.equal(
    quarters.size,
    QUARTERS.length,
    `node ${nodeId} should carry one row per quarter, got ${quarters.size}`
  );
}

// 2. TSMC's chokepoint score climbs across the four quarters.
const tsmc = history.get("tsmc");
assert.ok(tsmc, "TSMC should be in the history map");
const tsmcQ3 = tsmc.get("2025-Q3");
const tsmcQ4 = tsmc.get("2025-Q4");
const tsmcQ1 = tsmc.get("2026-Q1");
const tsmcQ2 = tsmc.get("2026-Q2");
assert.ok(tsmcQ3 && tsmcQ4 && tsmcQ1 && tsmcQ2, "TSMC should have all 4 quarters");
assert.ok(
  tsmcQ3.chokepoint_score < tsmcQ4.chokepoint_score &&
    tsmcQ4.chokepoint_score < tsmcQ1.chokepoint_score &&
    tsmcQ1.chokepoint_score < tsmcQ2.chokepoint_score,
  "TSMC chokepoint score should climb monotonically across the 4 quarters"
);

// 3. ASML dropped slightly in 2025-Q4 (the Nikon EUV competitor news).
const asml = history.get("asml");
assert.ok(asml, "ASML should be in the history map");
const asmlQ3 = asml.get("2025-Q3");
const asmlQ4 = asml.get("2025-Q4");
assert.ok(asmlQ3 && asmlQ4, "ASML should have Q3 and Q4 rows");
assert.ok(
  asmlQ4.chokepoint_score < asmlQ3.chokepoint_score,
  `ASML should dip in 2025-Q4, got ${asmlQ3.chokepoint_score} -> ${asmlQ4.chokepoint_score}`
);

// 4. Missing-node lookup returns undefined instead of throwing.
assert.equal(history.get("no-such-node"), undefined);

// 5. A handful of named nodes are present.
for (const id of ["tsmc", "asml", "sk-hynix", "ibiden", "nvidia"]) {
  assert.ok(history.has(id), `expected node ${id} in history map`);
}

console.log(
  `history.test OK: ${history.size} node(s), 4 quarter(s); ` +
    `TSMC climbs ${tsmcQ3.chokepoint_score}->${tsmcQ2.chokepoint_score}; ` +
    `ASML dips ${asmlQ3.chokepoint_score}->${asmlQ4.chokepoint_score}.`
);
