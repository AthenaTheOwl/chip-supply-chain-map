import type { FinancialSensitivity } from "./financial";
import { getScenarioById } from "./scenarios";
import { strengthWeight, type ScoreMap } from "./scoring";
import type {
  GraphData,
  Relation,
  SourceRef,
  Strength,
  SupplyEdge,
  SupplyNode
} from "./types";

export type RiskPacketFormat = "json" | "markdown";

export interface BuildRiskPacketInput {
  activeScenarioIds: string[];
  financialSensitivityRecords: FinancialSensitivity[];
  graph: GraphData;
  scoreBasis: string;
  scores: ScoreMap;
  sources: Map<string, SourceRef>;
  watchlistNodeIds: string[];
}

export interface WatchlistRiskPacket {
  version: 1;
  score_basis: string;
  active_scenarios: Array<{ id: string; label: string }>;
  watchlist: WatchlistNodeFact[];
  summary: WatchlistSummary;
  top_dependencies: DependencyExposure[];
  top_regions: RegionExposure[];
  sensitive_links: SensitiveLink[];
  financial_sensitivity: FinancialSensitivityFact[];
  evidence_sources: EvidenceSource[];
}

export interface WatchlistNodeFact {
  id: string;
  name: string;
  type: string;
  country: string;
  public_ticker: string;
  chokepoint_score: number | null;
  source_id: string;
  financial_record_count: number;
}

export interface WatchlistSummary {
  watched_node_count: number;
  average_chokepoint_score: number | null;
  max_chokepoint_score: {
    node_id: string;
    name: string;
    score: number;
  } | null;
  dependency_count: number;
  region_count: number;
  sensitive_link_count: number;
  financial_record_count: number;
}

export interface DependencyExposure {
  id: string;
  name: string;
  type: string;
  country: string;
  link_count: number;
  highest_strength: Strength;
  watched_nodes: string[];
  source_ids: string[];
}

export interface RegionExposure {
  country: string;
  node_count: number;
  watched_count: number;
  dependency_count: number;
  source_ids: string[];
}

export interface SensitiveLink {
  source: string;
  source_name: string;
  target: string;
  target_name: string;
  relation: Relation;
  strength: Strength;
  notes: string;
  source_id: string;
  watched_nodes: string[];
  active_scenarios: string[];
}

export interface FinancialSensitivityFact {
  company: string;
  ticker: string;
  node_id: string;
  node_name: string;
  scenario_id: string;
  scenario_label: string;
  active_scenario: boolean;
  metric_name: string;
  metric_value: string;
  period: string;
  sensitivity_band: FinancialSensitivity["sensitivity_band"];
  note: string;
  source_id: string;
}

export interface EvidenceSource {
  id: string;
  label: string | null;
  url: string | null;
}

const TOP_LIST_LIMIT = 6;
const SENSITIVE_LINK_LIMIT = 8;

export function buildWatchlistRiskPacket({
  activeScenarioIds,
  financialSensitivityRecords,
  graph,
  scoreBasis,
  scores,
  sources,
  watchlistNodeIds
}: BuildRiskPacketInput): WatchlistRiskPacket {
  const watchedNodes = uniqueValidNodes(graph, watchlistNodeIds);
  const watchedSet = new Set(watchedNodes.map((node) => node.id));
  const sourceIds = new Set<string>();
  const financialRecords = financialSensitivityRecords
    .filter((record) => watchedSet.has(record.node_id))
    .sort(compareFinancialRecords)
    .map((record) => toFinancialFact(record, graph, activeScenarioIds));

  const topDependencies = collectTopDependencies(graph, watchedNodes);
  const topRegions = collectTopRegions(graph, watchedNodes);
  const sensitiveLinks = collectSensitiveLinks(graph, watchedNodes, activeScenarioIds);

  const watchlist = watchedNodes.map((node) => {
    sourceIds.add(node.source_id);
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      country: node.country,
      public_ticker: node.public_ticker || "private",
      chokepoint_score: scores.get(node.id) ?? null,
      source_id: node.source_id,
      financial_record_count: financialRecords.filter(
        (record) => record.node_id === node.id
      ).length
    };
  });

  topDependencies.forEach((dependency) =>
    dependency.source_ids.forEach((sourceId) => sourceIds.add(sourceId))
  );
  topRegions.forEach((region) =>
    region.source_ids.forEach((sourceId) => sourceIds.add(sourceId))
  );
  sensitiveLinks.forEach((link) => sourceIds.add(link.source_id));
  financialRecords.forEach((record) => sourceIds.add(record.source_id));

  return {
    version: 1,
    score_basis: scoreBasis,
    active_scenarios: activeScenarioIds
      .map((id) => ({ id, label: getScenarioById(id)?.label ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    watchlist,
    summary: {
      watched_node_count: watchlist.length,
      average_chokepoint_score: averageScore(watchlist),
      max_chokepoint_score: maxScore(watchlist),
      dependency_count: topDependencies.length,
      region_count: topRegions.length,
      sensitive_link_count: sensitiveLinks.length,
      financial_record_count: financialRecords.length
    },
    top_dependencies: topDependencies,
    top_regions: topRegions,
    sensitive_links: sensitiveLinks,
    financial_sensitivity: financialRecords,
    evidence_sources: [...sourceIds].sort(compareSourceIds).map((id) => {
      const source = sources.get(id);
      return {
        id,
        label: source?.label ?? null,
        url: source?.url ?? null
      };
    })
  };
}

export function formatRiskPacket(
  packet: WatchlistRiskPacket,
  format: RiskPacketFormat
) {
  if (format === "json") {
    return `${JSON.stringify(packet, null, 2)}\n`;
  }

  return formatRiskPacketMarkdown(packet);
}

function uniqueValidNodes(graph: GraphData, nodeIds: string[]) {
  const seen = new Set<string>();
  const nodes: SupplyNode[] = [];
  for (const nodeId of nodeIds) {
    if (seen.has(nodeId)) {
      continue;
    }
    const node = graph.nodeById.get(nodeId);
    if (!node) {
      continue;
    }
    seen.add(nodeId);
    nodes.push(node);
  }
  return nodes;
}

function collectTopDependencies(graph: GraphData, watchedNodes: SupplyNode[]) {
  const watchedSet = new Set(watchedNodes.map((node) => node.id));
  const exposures = new Map<
    string,
    {
      node: SupplyNode;
      sourceIds: Set<string>;
      watchedNodes: Set<string>;
      linkCount: number;
      highestStrength: Strength;
    }
  >();

  for (const edge of graph.edges) {
    const consumer = consumerNodeId(edge);
    if (!watchedSet.has(consumer)) {
      continue;
    }
    const supplier = graph.nodeById.get(supplierNodeId(edge));
    if (!supplier) {
      continue;
    }
    const current = exposures.get(supplier.id) ?? {
      node: supplier,
      sourceIds: new Set<string>(),
      watchedNodes: new Set<string>(),
      linkCount: 0,
      highestStrength: edge.strength
    };
    current.sourceIds.add(edge.source_id);
    current.watchedNodes.add(consumer);
    current.linkCount += 1;
    if (strengthWeight[edge.strength] > strengthWeight[current.highestStrength]) {
      current.highestStrength = edge.strength;
    }
    exposures.set(supplier.id, current);
  }

  return [...exposures.values()]
    .map((entry): DependencyExposure => ({
      id: entry.node.id,
      name: entry.node.name,
      type: entry.node.type,
      country: entry.node.country,
      link_count: entry.linkCount,
      highest_strength: entry.highestStrength,
      watched_nodes: [...entry.watchedNodes].sort(),
      source_ids: [...entry.sourceIds].sort(compareSourceIds)
    }))
    .sort(
      (a, b) =>
        strengthWeight[b.highest_strength] - strengthWeight[a.highest_strength] ||
        b.link_count - a.link_count ||
        a.name.localeCompare(b.name)
    )
    .slice(0, TOP_LIST_LIMIT);
}

function collectTopRegions(graph: GraphData, watchedNodes: SupplyNode[]) {
  const watchedSet = new Set(watchedNodes.map((node) => node.id));
  const regions = new Map<
    string,
    {
      nodes: Set<string>;
      watched: Set<string>;
      dependencies: Set<string>;
      sourceIds: Set<string>;
    }
  >();

  const ensureRegion = (country: string) => {
    const current = regions.get(country) ?? {
      nodes: new Set<string>(),
      watched: new Set<string>(),
      dependencies: new Set<string>(),
      sourceIds: new Set<string>()
    };
    regions.set(country, current);
    return current;
  };

  for (const node of watchedNodes) {
    const region = ensureRegion(node.country);
    region.nodes.add(node.id);
    region.watched.add(node.id);
    region.sourceIds.add(node.source_id);
  }

  for (const edge of graph.edges) {
    const consumer = consumerNodeId(edge);
    if (!watchedSet.has(consumer)) {
      continue;
    }
    const supplier = graph.nodeById.get(supplierNodeId(edge));
    if (!supplier) {
      continue;
    }
    const region = ensureRegion(supplier.country);
    region.nodes.add(supplier.id);
    region.dependencies.add(supplier.id);
    region.sourceIds.add(supplier.source_id);
    region.sourceIds.add(edge.source_id);
  }

  return [...regions.entries()]
    .map(([country, region]): RegionExposure => ({
      country,
      node_count: region.nodes.size,
      watched_count: region.watched.size,
      dependency_count: region.dependencies.size,
      source_ids: [...region.sourceIds].sort(compareSourceIds)
    }))
    .sort(
      (a, b) =>
        b.node_count - a.node_count ||
        b.dependency_count - a.dependency_count ||
        a.country.localeCompare(b.country)
    )
    .slice(0, TOP_LIST_LIMIT);
}

function collectSensitiveLinks(
  graph: GraphData,
  watchedNodes: SupplyNode[],
  activeScenarioIds: string[]
) {
  const watchedSet = new Set(watchedNodes.map((node) => node.id));
  const links = new Map<string, SensitiveLink>();

  for (const edge of graph.edges) {
    const watchedEndpoints = [edge.source, edge.target].filter((id) =>
      watchedSet.has(id)
    );
    const consumer = consumerNodeId(edge);
    if (watchedSet.has(consumer) && !watchedEndpoints.includes(consumer)) {
      watchedEndpoints.push(consumer);
    }
    if (watchedEndpoints.length === 0) {
      continue;
    }
    if (!["critical", "high"].includes(edge.strength)) {
      continue;
    }

    const source = graph.nodeById.get(edge.source);
    const target = graph.nodeById.get(edge.target);
    const key = `${edge.source}|${edge.target}|${edge.relation}|${edge.source_id}`;
    const existing = links.get(key);
    const watched = new Set(existing?.watched_nodes ?? []);
    watchedEndpoints.forEach((nodeId) => watched.add(nodeId));

    links.set(key, {
      source: edge.source,
      source_name: source?.name ?? edge.source,
      target: edge.target,
      target_name: target?.name ?? edge.target,
      relation: edge.relation,
      strength: edge.strength,
      notes: edge.notes,
      source_id: edge.source_id,
      watched_nodes: [...watched].sort(),
      active_scenarios: activeScenarioIds
        .filter((scenarioId) => edgeMatchesScenario(edge, graph, scenarioId))
        .sort()
    });
  }

  return [...links.values()]
    .sort(
      (a, b) =>
        strengthWeight[b.strength] - strengthWeight[a.strength] ||
        b.watched_nodes.length - a.watched_nodes.length ||
        a.source_name.localeCompare(b.source_name) ||
        a.target_name.localeCompare(b.target_name)
    )
    .slice(0, SENSITIVE_LINK_LIMIT);
}

function toFinancialFact(
  record: FinancialSensitivity,
  graph: GraphData,
  activeScenarioIds: string[]
): FinancialSensitivityFact {
  const node = graph.nodeById.get(record.node_id);
  return {
    company: record.company,
    ticker: record.ticker,
    node_id: record.node_id,
    node_name: node?.name ?? record.node_id,
    scenario_id: record.scenario_id,
    scenario_label: getScenarioById(record.scenario_id)?.label ?? record.scenario_id,
    active_scenario: activeScenarioIds.includes(record.scenario_id),
    metric_name: record.metric_name,
    metric_value: record.metric_value,
    period: record.period,
    sensitivity_band: record.sensitivity_band,
    note: record.note,
    source_id: record.source_id
  };
}

function averageScore(watchlist: WatchlistNodeFact[]) {
  const scores = watchlist
    .map((node) => node.chokepoint_score)
    .filter((score): score is number => typeof score === "number");
  if (scores.length === 0) {
    return null;
  }
  return roundOne(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function maxScore(watchlist: WatchlistNodeFact[]) {
  const scored = watchlist.filter(
    (node): node is WatchlistNodeFact & { chokepoint_score: number } =>
      typeof node.chokepoint_score === "number"
  );
  if (scored.length === 0) {
    return null;
  }
  const top = [...scored].sort(
    (a, b) => b.chokepoint_score - a.chokepoint_score || a.name.localeCompare(b.name)
  )[0];
  return {
    node_id: top.id,
    name: top.name,
    score: top.chokepoint_score
  };
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function edgeMatchesScenario(edge: SupplyEdge, graph: GraphData, scenarioId: string) {
  const scenario = getScenarioById(scenarioId);
  const source = graph.nodeById.get(edge.source);
  const target = graph.nodeById.get(edge.target);
  if (!scenario || !source || !target) {
    return false;
  }
  return scenario.impactOn(source) > 1 || scenario.impactOn(target) > 1;
}

function consumerNodeId(edge: SupplyEdge) {
  if (edge.relation === "procures-from-fabless" || edge.relation === "procures-from-foundry") {
    return edge.source;
  }
  return edge.target;
}

function supplierNodeId(edge: SupplyEdge) {
  if (edge.relation === "procures-from-fabless" || edge.relation === "procures-from-foundry") {
    return edge.target;
  }
  return edge.source;
}

function compareFinancialRecords(
  a: FinancialSensitivity,
  b: FinancialSensitivity
) {
  const bandRank = { high: 0, medium: 1, watch: 2 } as const;
  return (
    bandRank[a.sensitivity_band] - bandRank[b.sensitivity_band] ||
    a.company.localeCompare(b.company) ||
    a.scenario_id.localeCompare(b.scenario_id)
  );
}

function compareSourceIds(a: string, b: string) {
  const aNumber = sourceNumber(a);
  const bNumber = sourceNumber(b);
  return aNumber - bNumber || a.localeCompare(b);
}

function sourceNumber(sourceId: string) {
  const parsed = Number(sourceId.replace(/^s/i, ""));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function formatRiskPacketMarkdown(packet: WatchlistRiskPacket) {
  const lines = [
    "# Chip supply-chain risk packet",
    "",
    `Score basis: ${packet.score_basis}`,
    `Active scenarios: ${
      packet.active_scenarios.length > 0
        ? packet.active_scenarios.map((scenario) => scenario.label).join(", ")
        : "none"
    }`,
    "",
    "## Watchlist",
    "",
    "| Node | Type | Country | Ticker | Score | Source |",
    "|---|---|---|---|---:|---|",
    ...packet.watchlist.map(
      (node) =>
        `| ${cell(node.name)} | ${cell(node.type)} | ${cell(node.country)} | ${cell(
          node.public_ticker
        )} | ${node.chokepoint_score ?? "n/a"} | ${cell(node.source_id)} |`
    ),
    "",
    "## Aggregate",
    "",
    `- Watched nodes: ${packet.summary.watched_node_count}`,
    `- Average chokepoint score: ${packet.summary.average_chokepoint_score ?? "n/a"}`,
    `- Max chokepoint score: ${
      packet.summary.max_chokepoint_score
        ? `${packet.summary.max_chokepoint_score.name} (${packet.summary.max_chokepoint_score.score})`
        : "n/a"
    }`,
    `- Financial sensitivity records: ${packet.summary.financial_record_count}`,
    "",
    "## Top Dependencies",
    "",
    ...listOrEmpty(
      packet.top_dependencies.map(
        (dependency) =>
          `- ${dependency.name} (${dependency.country}, ${dependency.highest_strength}) via ${dependency.source_ids.join(", ")}`
      )
    ),
    "",
    "## Top Regions",
    "",
    ...listOrEmpty(
      packet.top_regions.map(
        (region) =>
          `- ${region.country}: ${region.node_count} node(s), ${region.dependency_count} dependency node(s)`
      )
    ),
    "",
    "## Sensitive Links",
    "",
    ...listOrEmpty(
      packet.sensitive_links.map(
        (link) =>
          `- ${link.source_name} -> ${link.target_name}: ${link.relation}, ${link.strength}; ${link.notes} [${link.source_id}]`
      )
    ),
    "",
    "## Financial Sensitivity Facts",
    "",
    ...listOrEmpty(
      packet.financial_sensitivity.map(
        (record) =>
          `- ${record.company} ${record.metric_name}: ${record.metric_value} (${record.period}, ${record.scenario_label}) [${record.source_id}]`
      )
    ),
    "",
    "## Evidence",
    "",
    ...listOrEmpty(
      packet.evidence_sources.map((source) =>
        source.url
          ? `- ${source.id}: ${source.label ?? "source"} ${source.url}`
          : `- ${source.id}: ${source.label ?? "missing source"}`
      )
    )
  ];

  return `${lines.join("\n")}\n`;
}

function listOrEmpty(lines: string[]) {
  return lines.length > 0 ? lines : ["- none"];
}

function cell(value: string) {
  return value.replace(/\|/g, "\\|");
}
