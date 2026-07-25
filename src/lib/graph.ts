import edgesCsv from "../data/edges.csv?raw";
import nodesCsv from "../data/nodes.csv?raw";
import sourcesMd from "../data/sources.md?raw";
import { parseCsv } from "./csv";
import { parseSources } from "./sources";
import {
  NODE_TYPES,
  RELATIONS,
  STRENGTHS,
  type GraphData,
  type NodeType,
  type Relation,
  type Strength,
  type SupplyEdge,
  type SupplyNode
} from "./types";

export const graphData = loadGraph();
export const sourceRefs = parseSources(sourcesMd);

export function loadGraph(): GraphData {
  const nodes = parseCsv(nodesCsv).map(toNode);
  const edges = parseCsv(edgesCsv).map(toEdge);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return { nodes, edges, nodeById };
}

export function getDependencyEdges(graph: GraphData, nodeId: string) {
  return graph.edges.filter((edge) => consumerNodeId(edge) === nodeId);
}

export function getDependentEdges(graph: GraphData, nodeId: string) {
  return graph.edges.filter((edge) => supplierNodeId(edge) === nodeId);
}

export function relatedNodeIdForEdge(
  edge: SupplyEdge,
  nodeId: string,
  mode: "dependency" | "dependent"
) {
  if (mode === "dependency" && consumerNodeId(edge) === nodeId) {
    return supplierNodeId(edge);
  }

  if (mode === "dependent" && supplierNodeId(edge) === nodeId) {
    return consumerNodeId(edge);
  }

  return edge.source === nodeId ? edge.target : edge.source;
}

function toNode(row: Record<string, string>): SupplyNode {
  const type = row.type as NodeType;

  if (!NODE_TYPES.includes(type)) {
    throw new Error(`Invalid node type ${row.type} for ${row.id}`);
  }

  return {
    id: row.id,
    name: row.name,
    type,
    subtype: row.subtype,
    country: row.country,
    city: row.city,
    public_ticker: row.public_ticker,
    founded: Number(row.founded),
    short_description: row.short_description,
    source_id: row.source_id
  };
}

function toEdge(row: Record<string, string>): SupplyEdge {
  const relation = row.relation as Relation;
  const strength = row.strength as Strength;

  if (!RELATIONS.includes(relation)) {
    throw new Error(`Invalid edge relation ${row.relation}`);
  }

  if (!STRENGTHS.includes(strength)) {
    throw new Error(`Invalid edge strength ${row.strength}`);
  }

  return {
    source: row.source,
    target: row.target,
    relation,
    strength,
    notes: row.notes,
    source_id: row.source_id
  };
}

function consumerNodeId(edge: SupplyEdge) {
  if (
    edge.relation === "procures-from-fabless" ||
    edge.relation === "procures-from-foundry"
  ) {
    return edge.source;
  }

  return edge.target;
}

function supplierNodeId(edge: SupplyEdge) {
  if (
    edge.relation === "procures-from-fabless" ||
    edge.relation === "procures-from-foundry"
  ) {
    return edge.target;
  }

  return edge.source;
}
