export const NODE_TYPES = [
  "foundry",
  "fabless",
  "eda-ip",
  "equipment",
  "materials",
  "substrates",
  "memory",
  "osat-packaging",
  "hyperscaler",
  "auto-industrial"
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const RELATIONS = [
  "supplies-equipment",
  "supplies-materials",
  "supplies-substrates",
  "licenses-ip",
  "manufactures-for",
  "packages-for",
  "supplies-memory",
  "procures-from-foundry",
  "procures-from-fabless"
] as const;

export type Relation = (typeof RELATIONS)[number];

export const STRENGTHS = ["critical", "high", "medium", "low"] as const;

export type Strength = (typeof STRENGTHS)[number];

export interface SupplyNode {
  id: string;
  name: string;
  type: NodeType;
  subtype: string;
  country: string;
  city: string;
  public_ticker: string;
  founded: number;
  short_description: string;
  source_id: string;
}

export interface SupplyEdge {
  source: string;
  target: string;
  relation: Relation;
  strength: Strength;
  notes: string;
  source_id: string;
}

export interface GraphData {
  nodes: SupplyNode[];
  edges: SupplyEdge[];
  nodeById: Map<string, SupplyNode>;
}

export interface SourceRef {
  id: string;
  label: string;
  url: string;
}

export interface Scenario {
  id: string;
  label: string;
  description: string;
  impactOn: (node: SupplyNode) => number;
}
