import type { GraphData, Scenario, SupplyEdge, SupplyNode } from "./types";

export const SCENARIOS: Scenario[] = [
  {
    id: "taiwan-capacity-shock",
    label: "Taiwan capacity shock",
    description:
      "TSMC and Taiwan specialty foundry capacity is cut by a geopolitical or natural-disaster event.",
    impactOn: (node) =>
      ["tsmc", "umc", "vanguard", "psmc"].includes(node.id) ? 2.3 : 1
  },
  {
    id: "advanced-packaging-bottleneck",
    label: "Advanced packaging bottleneck",
    description:
      "CoWoS and high-end OSAT capacity tightens for AI accelerators and networking silicon.",
    impactOn: (node) =>
      ["tsmc", "ase", "amkor", "shinko", "ibiden", "unimicron"].includes(
        node.id
      )
        ? 1.8
        : 1
  },
  {
    id: "substrate-shortage",
    label: "ABF substrate shortage",
    description: "ABF substrate suppliers cannot keep pace with advanced packages.",
    impactOn: (node) =>
      ["ibiden", "unimicron", "shinko", "ajinomoto"].includes(node.id)
        ? 2.2
        : 1
  },
  {
    id: "lithography-constraint",
    label: "EUV equipment delay",
    description: "EUV and advanced DUV deliveries slip for two quarters.",
    impactOn: (node) =>
      ["asml", "nikon", "canon", "lasertec"].includes(node.id) ? 1.9 : 1
  },
  {
    id: "export-controls",
    label: "Tightened export controls",
    description: "US allied equipment access narrows for China-based advanced nodes.",
    impactOn: (node) => (["smic", "ymtc", "hua-hong"].includes(node.id) ? 1.5 : 1)
  },
  {
    id: "ai-demand-spike",
    label: "AI accelerator demand 3x",
    description: "Hyperscaler demand lifts pressure on HBM and advanced packaging.",
    impactOn: (node) =>
      [
        "nvidia",
        "amd",
        "broadcom",
        "marvell",
        "tsmc",
        "sk-hynix",
        "micron",
        "samsung-memory"
      ].includes(node.id)
        ? 1.6
        : 1
  }
];

export function getScenarioById(id: string) {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

export function getActiveScenarios(activeScenarioIds: string[]) {
  const activeSet = new Set(activeScenarioIds);
  return SCENARIOS.filter((scenario) => activeSet.has(scenario.id));
}

export function isEdgeSuppressedByScenarios(
  edge: SupplyEdge,
  graph: GraphData,
  activeScenarioIds: string[]
) {
  if (!activeScenarioIds.includes("export-controls")) {
    return false;
  }

  const source = graph.nodeById.get(edge.source);
  const target = graph.nodeById.get(edge.target);

  if (!source || !target) {
    return false;
  }

  const controlledSupplier =
    source.type === "equipment" && ["US", "JP", "NL"].includes(source.country);
  const chinaAdvancedTarget = ["smic", "ymtc", "hua-hong"].includes(target.id);

  return controlledSupplier && chinaAdvancedTarget;
}

export function scenarioMultiplier(node: SupplyNode, activeScenarioIds: string[]) {
  return getActiveScenarios(activeScenarioIds).reduce(
    (multiplier, scenario) => multiplier * scenario.impactOn(node),
    1
  );
}
