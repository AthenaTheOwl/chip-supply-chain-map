/**
 * Hand-rolled smoke test for the watchlist risk packet builder
 * (DEC-FIN-002). Pins that `buildWatchlistRiskPacket` produces a
 * deterministic client-side packet over sourced graph, score,
 * scenario, and financial sensitivity facts, and that
 * `formatRiskPacket` renders the packet to JSON / markdown without
 * mutating the underlying data.
 *
 * Run with `npm test`.
 *
 * Covers: R-FIN-002.
 */
import assert from "node:assert/strict";
import {
  buildWatchlistRiskPacket,
  formatRiskPacket,
  type WatchlistRiskPacket
} from "./riskPacket";
import type { FinancialSensitivity } from "./financial";
import type { GraphData, SourceRef, SupplyEdge, SupplyNode } from "./types";

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
    id: "asml",
    name: "ASML",
    type: "equipment",
    subtype: "lithography",
    country: "NL",
    city: "Veldhoven",
    public_ticker: "ASML",
    founded: 1984,
    short_description: "Lithography equipment supplier",
    source_id: "s22"
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
    notes: "EUV scanners for leading-edge nodes",
    source_id: "s22"
  },
  {
    source: "tsmc",
    target: "nvidia",
    relation: "manufactures-for",
    strength: "critical",
    notes: "Advanced-node wafers for AI accelerators",
    source_id: "s1"
  },
  {
    source: "sk-hynix",
    target: "nvidia",
    relation: "supplies-memory",
    strength: "high",
    notes: "HBM for accelerator packages",
    source_id: "s108"
  }
];

const graph: GraphData = {
  nodes,
  edges,
  nodeById: new Map(nodes.map((node) => [node.id, node]))
};

const financialSensitivityRecords: FinancialSensitivity[] = [
  {
    company: "NVIDIA",
    ticker: "NVDA",
    node_id: "nvidia",
    scenario_id: "blackwell-mi-supply-drought",
    metric_name: "Data Center revenue",
    metric_value: "USD 193.7B",
    period: "FY2026",
    source_id: "s104",
    sensitivity_band: "high",
    note: "Blackwell shipment timing is tied to HBM and packaging availability"
  },
  {
    company: "TSMC",
    ticker: "TSM",
    node_id: "tsmc",
    scenario_id: "hbm-cowos-crunch",
    metric_name: "Advanced technology wafer revenue share",
    metric_value: "74%",
    period: "FY2025",
    source_id: "s106",
    sensitivity_band: "high",
    note: "Advanced nodes and packaging carry accelerator wafer demand"
  }
];

const sources = new Map<string, SourceRef>([
  ["s1", { id: "s1", label: "TSMC annual report", url: "https://example.com/tsmc" }],
  ["s18", { id: "s18", label: "NVIDIA annual report", url: "https://example.com/nvidia" }],
  ["s22", { id: "s22", label: "ASML annual report", url: "https://example.com/asml" }],
  ["s104", { id: "s104", label: "NVIDIA revenue source", url: "https://example.com/nvda-revenue" }],
  ["s106", { id: "s106", label: "TSMC revenue source", url: "https://example.com/tsm-revenue" }],
  ["s108", { id: "s108", label: "SK hynix source", url: "https://example.com/skhynix" }]
]);

const packet = buildWatchlistRiskPacket({
  activeScenarioIds: ["blackwell-mi-supply-drought", "hbm-cowos-crunch"],
  financialSensitivityRecords,
  graph,
  scoreBasis: "current",
  scores: new Map([
    ["nvidia", 80],
    ["tsmc", 100],
    ["asml", 70],
    ["sk-hynix", 65]
  ]),
  sources,
  watchlistNodeIds: ["nvidia", "tsmc", "nvidia", "missing-node"]
});

assert.equal(packet.summary.watched_node_count, 2);
assert.equal(packet.summary.average_chokepoint_score, 90);
assert.deepEqual(packet.summary.max_chokepoint_score, {
  node_id: "tsmc",
  name: "TSMC",
  score: 100
});
assert.equal(packet.summary.financial_record_count, 2);
assert.ok(
  packet.top_dependencies.some((dependency) => dependency.id === "asml"),
  "ASML should be a top dependency for watched TSMC"
);
assert.ok(
  packet.top_dependencies.some((dependency) => dependency.id === "sk-hynix"),
  "SK hynix should be a top dependency for watched NVIDIA"
);
assert.ok(
  packet.top_regions.some((region) => region.country === "TW"),
  "watched TSMC should add Taiwan region exposure"
);
assert.ok(
  packet.sensitive_links.some(
    (link) => link.source === "tsmc" && link.target === "nvidia"
  ),
  "critical foundry-to-fabless edge should be exported"
);
assert.equal(packet.financial_sensitivity[0]?.active_scenario, true);
assert.ok(
  packet.evidence_sources.some((source) => source.id === "s104"),
  "financial evidence source should be retained"
);

const json = JSON.parse(formatRiskPacket(packet, "json")) as WatchlistRiskPacket;
assert.equal(json.version, 1);
assert.equal(json.watchlist.length, 2);

const markdown = formatRiskPacket(packet, "markdown");
assert.match(markdown, /# Chip supply-chain risk packet/);
assert.match(markdown, /NVIDIA Data Center revenue: USD 193\.7B/);
assert.match(markdown, /s104: NVIDIA revenue source/);

console.log(
  `riskPacket.test OK: ${packet.watchlist.length} watched node(s), ` +
    `${packet.sensitive_links.length} sensitive link(s), ` +
    `${packet.evidence_sources.length} evidence source(s).`
);
