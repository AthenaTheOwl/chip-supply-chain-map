/**
 * Hand-rolled smoke test for the two new scenarios added under DEC-FIN-009:
 *
 * - `cowos-l-bottleneck` (the deepened advanced-packaging-bottleneck variant)
 * - `lithography-equipment-constraint` (the lithography supplier constraint)
 *
 * The test covers four contracts:
 *
 * 1. Both scenarios appear in `SCENARIOS` and are reachable via `getScenarioById`.
 * 2. The scenario multipliers fire on the intended node sets and leave other
 *    nodes untouched.
 * 3. The `edgeImpact` callbacks bump strength on the intended edge classes and
 *    leave other edges untouched.
 * 4. `computeChokepointScores` updates sensibly when the scenarios toggle on:
 *    the directly exposed nodes' scores go up, untargeted nodes do not.
 *
 * Run with `npm test`.
 */
import assert from "node:assert/strict";
import {
  SCENARIOS,
  adjustedEdgeStrength,
  bumpStrength,
  getScenarioById,
  scenarioEdgeWeightMultiplier,
  scenarioLeadTimeBumpMonths,
  scenarioMultiplier
} from "./scenarios";
import {
  betweennessCentrality,
  chokepointScore,
  computeChokepointScores
} from "./scoring";
import type { GraphData, SupplyEdge, SupplyNode } from "./types";

const nodes: SupplyNode[] = [
  {
    id: "tsmc",
    name: "TSMC",
    type: "foundry",
    subtype: "leading-edge",
    country: "TW",
    city: "Hsinchu",
    public_ticker: "TSM",
    founded: 1987,
    short_description: "Leading-edge foundry",
    source_id: "s1"
  },
  {
    id: "samsung-foundry",
    name: "Samsung Foundry",
    type: "foundry",
    subtype: "leading-edge",
    country: "KR",
    city: "Hwaseong",
    public_ticker: "005930.KS",
    founded: 1974,
    short_description: "Leading-edge foundry",
    source_id: "s2"
  },
  {
    id: "intel-foundry",
    name: "Intel Foundry",
    type: "foundry",
    subtype: "leading-edge",
    country: "US",
    city: "Hillsboro",
    public_ticker: "INTC",
    founded: 1968,
    short_description: "IDM-foundry",
    source_id: "s3"
  },
  {
    id: "asml",
    name: "ASML",
    type: "equipment",
    subtype: "lithography",
    country: "NL",
    city: "Veldhoven",
    public_ticker: "ASML",
    founded: 1984,
    short_description: "EUV and DUV supplier",
    source_id: "s22"
  },
  {
    id: "lasertec",
    name: "Lasertec",
    type: "equipment",
    subtype: "mask-inspection",
    country: "JP",
    city: "Yokohama",
    public_ticker: "6920.T",
    founded: 1960,
    short_description: "EUV mask inspection",
    source_id: "s23"
  },
  {
    id: "ase",
    name: "ASE",
    type: "osat-packaging",
    subtype: "advanced-packaging",
    country: "TW",
    city: "Kaohsiung",
    public_ticker: "ASX",
    founded: 1984,
    short_description: "OSAT and packaging",
    source_id: "s40"
  },
  {
    id: "ibiden",
    name: "Ibiden",
    type: "substrates",
    subtype: "abf-substrate",
    country: "JP",
    city: "Ogaki",
    public_ticker: "4062.T",
    founded: 1912,
    short_description: "ABF substrate supplier",
    source_id: "s30"
  },
  {
    id: "nvidia-blackwell-gb200",
    name: "NVIDIA Blackwell GB200",
    type: "fabless",
    subtype: "ai-accelerator-platform",
    country: "US",
    city: "Santa Clara",
    public_ticker: "NVDA",
    founded: 2024,
    short_description: "Accelerator platform row",
    source_id: "s60"
  },
  {
    id: "amd-instinct-mi-family",
    name: "AMD Instinct MI family",
    type: "fabless",
    subtype: "ai-accelerator-platform",
    country: "US",
    city: "Santa Clara",
    public_ticker: "AMD",
    founded: 2023,
    short_description: "Accelerator platform row",
    source_id: "s61"
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    type: "fabless",
    subtype: "gpu",
    country: "US",
    city: "Santa Clara",
    public_ticker: "NVDA",
    founded: 1993,
    short_description: "GPU designer",
    source_id: "s18"
  },
  {
    id: "ajinomoto",
    name: "Ajinomoto Fine-Techno",
    type: "materials",
    subtype: "abf-resin",
    country: "JP",
    city: "Tokyo",
    public_ticker: "2802.T",
    founded: 1909,
    short_description: "ABF resin",
    source_id: "s31"
  },
  {
    id: "sk-hynix",
    name: "SK hynix",
    type: "memory",
    subtype: "hbm",
    country: "KR",
    city: "Icheon",
    public_ticker: "000660.KS",
    founded: 1983,
    short_description: "HBM supplier",
    source_id: "s108"
  }
];

const edges: SupplyEdge[] = [
  {
    source: "asml",
    target: "tsmc",
    relation: "supplies-equipment",
    strength: "critical",
    notes: "EUV scanners",
    source_id: "s22"
  },
  {
    source: "asml",
    target: "samsung-foundry",
    relation: "supplies-equipment",
    strength: "high",
    notes: "EUV scanners",
    source_id: "s22"
  },
  {
    source: "asml",
    target: "intel-foundry",
    relation: "supplies-equipment",
    strength: "medium",
    notes: "EUV scanners",
    source_id: "s22"
  },
  {
    source: "lasertec",
    target: "tsmc",
    relation: "supplies-equipment",
    strength: "high",
    notes: "EUV mask inspection",
    source_id: "s23"
  },
  {
    source: "ase",
    target: "nvidia-blackwell-gb200",
    relation: "packages-for",
    strength: "high",
    notes: "OSAT for Blackwell",
    source_id: "s60"
  },
  {
    source: "ibiden",
    target: "nvidia-blackwell-gb200",
    relation: "supplies-substrates",
    strength: "medium",
    notes: "ABF substrate",
    source_id: "s60"
  },
  {
    source: "ibiden",
    target: "amd-instinct-mi-family",
    relation: "supplies-substrates",
    strength: "high",
    notes: "ABF substrate",
    source_id: "s61"
  },
  {
    source: "tsmc",
    target: "nvidia-blackwell-gb200",
    relation: "manufactures-for",
    strength: "critical",
    notes: "wafer fab for Blackwell",
    source_id: "s60"
  },
  {
    source: "ajinomoto",
    target: "ibiden",
    relation: "supplies-materials",
    strength: "high",
    notes: "ABF resin",
    source_id: "s31"
  }
];

const graph: GraphData = {
  nodes,
  edges,
  nodeById: new Map(nodes.map((node) => [node.id, node]))
};

// --- 1. registry plumbing --------------------------------------------------

const cowosScenario = getScenarioById("cowos-l-bottleneck");
const lithoScenario = getScenarioById("lithography-equipment-constraint");

assert.ok(cowosScenario, "cowos-l-bottleneck scenario is registered");
assert.ok(
  lithoScenario,
  "lithography-equipment-constraint scenario is registered"
);

const scenarioIds = SCENARIOS.map((scenario) => scenario.id);
assert.ok(
  scenarioIds.includes("cowos-l-bottleneck"),
  "SCENARIOS array exposes cowos-l-bottleneck"
);
assert.ok(
  scenarioIds.includes("lithography-equipment-constraint"),
  "SCENARIOS array exposes lithography-equipment-constraint"
);

// --- 2. multipliers fire on intended nodes ---------------------------------

// cowos-l-bottleneck targets the packaging-side cluster.
const cowosTargets = [
  "tsmc",
  "ase",
  "ibiden",
  "nvidia-blackwell-gb200",
  "amd-instinct-mi-family"
];
for (const id of cowosTargets) {
  const node = graph.nodeById.get(id)!;
  assert.equal(
    scenarioMultiplier(node, ["cowos-l-bottleneck"]),
    2.1,
    `cowos-l-bottleneck bumps ${id} by 2.1x`
  );
}

// Untargeted node stays at 1.
assert.equal(
  scenarioMultiplier(graph.nodeById.get("ajinomoto")!, ["cowos-l-bottleneck"]),
  1
);
assert.equal(
  scenarioMultiplier(graph.nodeById.get("sk-hynix")!, ["cowos-l-bottleneck"]),
  1
);

// lithography-equipment-constraint targets the lithography + leading-edge cluster.
const lithoTargets = [
  "asml",
  "lasertec",
  "tsmc",
  "samsung-foundry",
  "intel-foundry",
  "sk-hynix"
];
for (const id of lithoTargets) {
  const node = graph.nodeById.get(id)!;
  assert.equal(
    scenarioMultiplier(node, ["lithography-equipment-constraint"]),
    2.0,
    `lithography-equipment-constraint bumps ${id} by 2.0x`
  );
}

// Untargeted: ase, ibiden, nvidia stay at 1.
for (const id of ["ase", "ibiden", "nvidia", "ajinomoto"]) {
  const node = graph.nodeById.get(id)!;
  assert.equal(
    scenarioMultiplier(node, ["lithography-equipment-constraint"]),
    1,
    `lithography-equipment-constraint does not touch ${id}`
  );
}

// --- 3. edge-strength impact ----------------------------------------------

// cowos-l-bottleneck bumps packaging-for / supplies-substrates / manufactures-for
// edges into accelerator platform rows one step.
const aseToBlackwell = edges.find(
  (e) => e.source === "ase" && e.target === "nvidia-blackwell-gb200"
)!;
assert.equal(aseToBlackwell.strength, "high");
assert.equal(
  adjustedEdgeStrength(aseToBlackwell, graph, ["cowos-l-bottleneck"]),
  "critical"
);

const ibidenToBlackwell = edges.find(
  (e) => e.source === "ibiden" && e.target === "nvidia-blackwell-gb200"
)!;
assert.equal(
  adjustedEdgeStrength(ibidenToBlackwell, graph, ["cowos-l-bottleneck"]),
  "high"
);

const tsmcToBlackwell = edges.find(
  (e) => e.source === "tsmc" && e.target === "nvidia-blackwell-gb200"
)!;
// critical stays at critical (already capped)
assert.equal(
  adjustedEdgeStrength(tsmcToBlackwell, graph, ["cowos-l-bottleneck"]),
  "critical"
);

// Materials edges into substrates are not touched by cowos-l-bottleneck.
const ajinomotoToIbiden = edges.find(
  (e) => e.source === "ajinomoto" && e.target === "ibiden"
)!;
assert.equal(
  adjustedEdgeStrength(ajinomotoToIbiden, graph, ["cowos-l-bottleneck"]),
  "high",
  "cowos-l-bottleneck leaves supplies-materials edges alone"
);

// lithography-equipment-constraint bumps supplies-equipment edges from the
// four lithography suppliers into leading-edge foundries.
const asmlToTsmc = edges.find(
  (e) => e.source === "asml" && e.target === "tsmc"
)!;
assert.equal(
  adjustedEdgeStrength(asmlToTsmc, graph, ["lithography-equipment-constraint"]),
  "critical",
  "asml->tsmc edge stays critical (already capped)"
);

const asmlToSamsung = edges.find(
  (e) => e.source === "asml" && e.target === "samsung-foundry"
)!;
assert.equal(
  adjustedEdgeStrength(asmlToSamsung, graph, [
    "lithography-equipment-constraint"
  ]),
  "critical",
  "asml->samsung-foundry bumps high->critical"
);

const asmlToIntel = edges.find(
  (e) => e.source === "asml" && e.target === "intel-foundry"
)!;
assert.equal(
  adjustedEdgeStrength(asmlToIntel, graph, [
    "lithography-equipment-constraint"
  ]),
  "high",
  "asml->intel-foundry bumps medium->high"
);

// Litho scenario leaves OSAT-platform edges alone.
assert.equal(
  adjustedEdgeStrength(aseToBlackwell, graph, [
    "lithography-equipment-constraint"
  ]),
  "high"
);

// --- bumpStrength helper edge cases ---------------------------------------

assert.equal(bumpStrength("low"), "medium");
assert.equal(bumpStrength("medium"), "high");
assert.equal(bumpStrength("high"), "critical");
assert.equal(bumpStrength("critical"), "critical", "critical caps at critical");
assert.equal(bumpStrength("low", 2), "high");

// --- node attribute impact (lead-time bumps) ------------------------------

assert.equal(
  scenarioLeadTimeBumpMonths(graph.nodeById.get("asml")!, [
    "lithography-equipment-constraint"
  ]),
  9
);
assert.equal(
  scenarioLeadTimeBumpMonths(graph.nodeById.get("lasertec")!, [
    "lithography-equipment-constraint"
  ]),
  6
);
assert.equal(
  scenarioLeadTimeBumpMonths(graph.nodeById.get("tsmc")!, [
    "cowos-l-bottleneck"
  ]),
  6
);
assert.equal(
  scenarioLeadTimeBumpMonths(graph.nodeById.get("ibiden")!, [
    "cowos-l-bottleneck"
  ]),
  6,
  "ABF substrate subtype gets the lead-time bump"
);
assert.equal(
  scenarioLeadTimeBumpMonths(graph.nodeById.get("nvidia")!, [
    "cowos-l-bottleneck"
  ]),
  0,
  "untargeted node gets no lead-time bump"
);

// Compounding: both scenarios active stacks the bumps.
assert.equal(
  scenarioLeadTimeBumpMonths(graph.nodeById.get("tsmc")!, [
    "cowos-l-bottleneck",
    "lithography-equipment-constraint"
  ]),
  6,
  "tsmc only gets the cowos lead-time bump (litho bumps asml/lasertec)"
);
assert.equal(
  scenarioLeadTimeBumpMonths(graph.nodeById.get("asml")!, [
    "cowos-l-bottleneck",
    "lithography-equipment-constraint"
  ]),
  9
);

// --- edge weight multiplier respects strength bumps -----------------------

const baselineAsmlToIntel = scenarioEdgeWeightMultiplier(
  asmlToIntel,
  graph,
  []
);
const activeAsmlToIntel = scenarioEdgeWeightMultiplier(asmlToIntel, graph, [
  "lithography-equipment-constraint"
]);
assert.ok(
  activeAsmlToIntel > baselineAsmlToIntel,
  "asml->intel-foundry edge weight goes up under litho scenario"
);

// --- 4. chokepoint scores move sensibly under toggle ----------------------

// computeChokepointScores normalizes against the per-graph max, so toggling
// a scenario that lifts the max-scoring node drags every other node's
// normalized share down. Test the raw heuristic instead: it returns the
// pre-normalization score so per-node comparisons remain like-for-like.
const centrality = betweennessCentrality(graph);
function rawScore(id: string, scenarios: string[]) {
  const node = graph.nodeById.get(id)!;
  return chokepointScore(node, graph, centrality, scenarios);
}

// cowos-l-bottleneck strictly raises the raw score of every node it targets
// that sits on a betweenness path; nodes off every path stay at 0.
const cowosScenarios = ["cowos-l-bottleneck"];
assert.ok(
  rawScore("tsmc", cowosScenarios) > rawScore("tsmc", []),
  "tsmc raw score rises under cowos-l-bottleneck"
);
assert.ok(
  rawScore("ibiden", cowosScenarios) > rawScore("ibiden", []),
  "ibiden raw score rises under cowos-l-bottleneck"
);
assert.ok(
  rawScore("nvidia-blackwell-gb200", cowosScenarios) >
    rawScore("nvidia-blackwell-gb200", []),
  "Blackwell row raw score rises under cowos-l-bottleneck"
);

// lithography-equipment-constraint strictly raises asml's raw score and
// leaves the unaffected ase row untouched.
const lithoScenarios = ["lithography-equipment-constraint"];
assert.ok(
  rawScore("asml", lithoScenarios) > rawScore("asml", []),
  "asml raw score rises under lithography-equipment-constraint"
);
assert.equal(
  rawScore("ase", lithoScenarios),
  rawScore("ase", []),
  "ase raw score is unchanged under lithography-equipment-constraint"
);

// Compounding scenarios composes multiplicatively on shared nodes.
const bothScenarios = [
  "cowos-l-bottleneck",
  "lithography-equipment-constraint"
];
assert.ok(
  rawScore("tsmc", bothScenarios) > rawScore("tsmc", cowosScenarios),
  "tsmc raw score under both scenarios exceeds the single-scenario score"
);

// Snapshot-style guard: lock the relative ordering of the affected nodes
// under each scenario so future heuristic edits surface as a test break.
const cowosNormalized = computeChokepointScores(graph, cowosScenarios);
const lithoNormalized = computeChokepointScores(graph, lithoScenarios);
// Under cowos-l, ibiden ranks at or above ase (substrate is the gating layer).
assert.ok(
  cowosNormalized.get("ibiden")! >= cowosNormalized.get("ase")!,
  "cowos-l-bottleneck keeps ibiden at or above ase in normalized rank"
);
// Under litho, asml is the top normalized scorer.
const lithoMax = Math.max(...lithoNormalized.values());
assert.equal(
  lithoNormalized.get("asml"),
  lithoMax,
  "asml is the top normalized scorer under lithography-equipment-constraint"
);

console.log("scenarios.test: ok");
