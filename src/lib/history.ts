import nodesHistoryCsv from "../data/nodes_history.csv?raw";
import { parseCsv } from "./csv";

export const QUARTERS = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"] as const;
export type Quarter = (typeof QUARTERS)[number];
export type QuarterOrCurrent = Quarter | "current";

export interface QuarterScores {
  chokepoint_score: number;
  geography_concentration: number;
  substitutability_penalty: number;
  lead_time_penalty: number;
  dependency_centrality: number;
  notes: string;
}

export type HistoryByNode = Map<string, Map<Quarter, QuarterScores>>;

export const history: HistoryByNode = loadHistory();

export function loadHistory(): HistoryByNode {
  const rows = parseCsv(nodesHistoryCsv);
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

export function getScoresAtQuarter(
  quarter: Quarter,
  nodeId: string
): QuarterScores | null {
  const nodeMap = history.get(nodeId);
  if (!nodeMap) {
    return null;
  }
  const scores = nodeMap.get(quarter);
  if (scores) {
    return scores;
  }
  return nearestQuarter(nodeMap, quarter);
}

export function getScoreMapForQuarter(quarter: Quarter): Map<string, number> {
  const scores = new Map<string, number>();
  history.forEach((nodeMap, nodeId) => {
    const direct = nodeMap.get(quarter);
    if (direct) {
      scores.set(nodeId, direct.chokepoint_score);
      return;
    }
    const fallback = nearestQuarter(nodeMap, quarter);
    if (fallback) {
      scores.set(nodeId, fallback.chokepoint_score);
    }
  });
  return scores;
}

function nearestQuarter(
  nodeMap: Map<Quarter, QuarterScores>,
  target: Quarter
): QuarterScores | null {
  const targetIndex = QUARTERS.indexOf(target);
  if (targetIndex === -1) {
    return null;
  }
  for (let offset = 1; offset < QUARTERS.length; offset += 1) {
    const lower = QUARTERS[targetIndex - offset];
    if (lower && nodeMap.has(lower)) {
      return nodeMap.get(lower) ?? null;
    }
    const upper = QUARTERS[targetIndex + offset];
    if (upper && nodeMap.has(upper)) {
      return nodeMap.get(upper) ?? null;
    }
  }
  return null;
}
