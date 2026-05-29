import {
  isEdgeSuppressedByScenarios,
  scenarioEdgeWeightMultiplier,
  scenarioLeadTimeBumpMonths,
  scenarioMultiplier
} from "./scenarios";
import type { GraphData, SupplyNode } from "./types";

export type ScoreMap = Map<string, number>;

const LEAD_TIME_BY_TYPE: Record<SupplyNode["type"], number> = {
  foundry: 30,
  fabless: 12,
  "eda-ip": 18,
  equipment: 24,
  materials: 12,
  substrates: 14,
  memory: 20,
  "osat-packaging": 12,
  hyperscaler: 8,
  "auto-industrial": 10
};

export const strengthWeight = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
} as const;

export function computeChokepointScores(
  graph: GraphData,
  activeScenarioIds: string[]
): ScoreMap {
  const adjustedGraph = {
    ...graph,
    edges: graph.edges.filter(
      (edge) => !isEdgeSuppressedByScenarios(edge, graph, activeScenarioIds)
    )
  };
  const centrality = betweennessCentrality(adjustedGraph);
  const rawScores = graph.nodes.map((node) => [
    node.id,
    chokepointScore(node, adjustedGraph, centrality, activeScenarioIds)
  ] as const);
  const maxScore = Math.max(...rawScores.map(([, score]) => score), 1);

  return new Map(
    rawScores.map(([id, score]) => [id, Math.round((score / maxScore) * 100)])
  );
}

export function chokepointScore(
  node: SupplyNode,
  graph: GraphData,
  centrality: ScoreMap,
  activeScenarioIds: string[]
) {
  const centralityFactor = centrality.get(node.id) ?? 0;
  const geoConcentration = 1 + topRegionShare(node, graph);
  const alternatives = countAlternatives(graph, node);
  const substitutability = 1 / (1 + Math.log(1 + alternatives));
  const baseLeadTime = leadTimeMonths(node);
  const bumpMonths = scenarioLeadTimeBumpMonths(node, activeScenarioIds);
  const leadTime = 1 + (baseLeadTime + bumpMonths) / 12;
  const scenarioFactor = scenarioMultiplier(node, activeScenarioIds);
  const edgePressure = scenarioEdgePressure(node, graph, activeScenarioIds);

  return (
    centralityFactor *
    geoConcentration *
    substitutability *
    leadTime *
    scenarioFactor *
    edgePressure
  );
}

function scenarioEdgePressure(
  node: SupplyNode,
  graph: GraphData,
  activeScenarioIds: string[]
) {
  if (activeScenarioIds.length === 0) {
    return 1;
  }
  const incident = graph.edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id
  );
  if (incident.length === 0) {
    return 1;
  }
  let baseline = 0;
  let active = 0;
  for (const edge of incident) {
    baseline += scenarioEdgeWeightMultiplier(edge, graph, []);
    active += scenarioEdgeWeightMultiplier(edge, graph, activeScenarioIds);
  }
  if (baseline === 0) {
    return 1;
  }
  return active / baseline;
}

export function betweennessCentrality(graph: GraphData): ScoreMap {
  const ids = graph.nodes.map((node) => node.id);
  const adjacency = buildAdjacency(graph);
  const scores = new Map(ids.map((id) => [id, 0]));

  ids.forEach((source) => {
    const stack: string[] = [];
    const predecessors = new Map(ids.map((id) => [id, [] as string[]]));
    const sigma = new Map(ids.map((id) => [id, 0]));
    const distance = new Map(ids.map((id) => [id, -1]));
    const queue: string[] = [source];

    sigma.set(source, 1);
    distance.set(source, 0);

    while (queue.length > 0) {
      const vertex = queue.shift() as string;
      stack.push(vertex);

      for (const neighbor of adjacency.get(vertex) ?? []) {
        if (distance.get(neighbor) === -1) {
          queue.push(neighbor);
          distance.set(neighbor, (distance.get(vertex) ?? 0) + 1);
        }

        if (distance.get(neighbor) === (distance.get(vertex) ?? 0) + 1) {
          sigma.set(neighbor, (sigma.get(neighbor) ?? 0) + (sigma.get(vertex) ?? 0));
          predecessors.get(neighbor)?.push(vertex);
        }
      }
    }

    const dependency = new Map(ids.map((id) => [id, 0]));

    while (stack.length > 0) {
      const node = stack.pop() as string;

      for (const predecessor of predecessors.get(node) ?? []) {
        const sigmaNode = sigma.get(node) ?? 1;
        const share = (sigma.get(predecessor) ?? 0) / sigmaNode;
        const delta = share * (1 + (dependency.get(node) ?? 0));
        dependency.set(predecessor, (dependency.get(predecessor) ?? 0) + delta);
      }

      if (node !== source) {
        scores.set(node, (scores.get(node) ?? 0) + (dependency.get(node) ?? 0));
      }
    }
  });

  const max = Math.max(...scores.values(), 1);
  return new Map([...scores].map(([id, score]) => [id, score / max]));
}

function buildAdjacency(graph: GraphData) {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]));

  graph.edges.forEach((edge) => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  return adjacency;
}

function topRegionShare(node: SupplyNode, graph: GraphData) {
  const peerGroup = graph.nodes.filter(
    (candidate) =>
      candidate.type === node.type &&
      (candidate.subtype === node.subtype ||
        graph.nodes.filter((peer) => peer.type === node.type).length < 8)
  );
  const countryCounts = peerGroup.reduce<Map<string, number>>((counts, candidate) => {
    counts.set(candidate.country, (counts.get(candidate.country) ?? 0) + 1);
    return counts;
  }, new Map());
  const largestCountryCount = Math.max(...countryCounts.values(), 1);

  return largestCountryCount / Math.max(peerGroup.length, 1);
}

function countAlternatives(graph: GraphData, node: SupplyNode) {
  const exactPeers = graph.nodes.filter(
    (candidate) =>
      candidate.id !== node.id &&
      candidate.type === node.type &&
      candidate.subtype === node.subtype
  );

  if (exactPeers.length > 0) {
    return exactPeers.length;
  }

  return graph.nodes.filter(
    (candidate) => candidate.id !== node.id && candidate.type === node.type
  ).length;
}

function leadTimeMonths(node: SupplyNode) {
  if (node.id === "asml") {
    return 30;
  }

  if (["tsmc", "samsung-foundry", "intel-foundry"].includes(node.id)) {
    return 36;
  }

  if (["ibiden", "unimicron", "shinko"].includes(node.id)) {
    return 18;
  }

  return LEAD_TIME_BY_TYPE[node.type];
}
