import type {
  GraphData,
  Scenario,
  ScenarioEdgeAdjustment,
  ScenarioNodeAttributeAdjustment,
  Strength,
  SupplyEdge,
  SupplyNode
} from "./types";

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
      [
        "tsmc",
        "ase",
        "amkor",
        "shinko",
        "ibiden",
        "unimicron",
        "nvidia-blackwell-gb200",
        "amd-instinct-mi-family"
      ].includes(node.id)
        ? 1.8
        : 1
  },
  {
    id: "cowos-l-bottleneck",
    label: "CoWoS-L bottleneck (deepened)",
    description:
      "CoWoS-L line capacity for the largest reticles is rationed; packaging-side edges into Blackwell and MI rows tighten one strength step.",
    impactOn: (node) =>
      [
        "tsmc",
        "ase",
        "amkor",
        "ibiden",
        "unimicron",
        "shinko",
        "nvidia-blackwell-gb200",
        "amd-instinct-mi-family"
      ].includes(node.id)
        ? 2.1
        : 1,
    edgeImpact: (edge) => bumpStrengthForAccelerators(edge),
    nodeAttributeImpact: (node) =>
      node.id === "tsmc" || node.subtype === "abf-substrate"
        ? { leadTimeBumpMonths: 6 }
        : undefined
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
    id: "lithography-equipment-constraint",
    label: "Lithography equipment constraint",
    description:
      "High-NA EUV plus mask-inspection capacity is rationed; lithography-supplier edges into leading-edge foundries tighten one strength step and ASML lead time stretches.",
    impactOn: (node) =>
      [
        "asml",
        "lasertec",
        "nikon",
        "canon",
        "tsmc",
        "samsung-foundry",
        "intel-foundry",
        "sk-hynix",
        "micron"
      ].includes(node.id)
        ? 2.0
        : 1,
    edgeImpact: (edge, graph) => bumpStrengthForLithoEquipment(edge, graph),
    nodeAttributeImpact: (node) =>
      node.id === "asml"
        ? { leadTimeBumpMonths: 9 }
        : node.id === "lasertec"
          ? { leadTimeBumpMonths: 6 }
          : undefined
  },
  {
    id: "blackwell-mi-supply-drought",
    label: "Blackwell and MI supply drought",
    description:
      "Cloud demand outstrips GB200 and Instinct MI accelerator supply for a full allocation cycle.",
    impactOn: (node) =>
      [
        "nvidia",
        "amd",
        "nvidia-blackwell-gb200",
        "amd-instinct-mi-family",
        "tsmc",
        "sk-hynix",
        "micron",
        "samsung-memory",
        "aws",
        "microsoft",
        "google",
        "oracle-cloud",
        "coreweave"
      ].includes(node.id)
        ? 1.7
        : 1
  },
  {
    id: "taiwan-ai-cluster-stress",
    label: "Taiwan AI cluster stress",
    description:
      "Taiwan foundry packaging and substrate flows for AI systems are interrupted at the same time.",
    impactOn: (node) =>
      [
        "tsmc",
        "umc",
        "vanguard",
        "psmc",
        "ase",
        "powertech",
        "unimicron",
        "nvidia-blackwell-gb200",
        "amd-instinct-mi-family"
      ].includes(node.id)
        ? 1.9
        : 1
  },
  {
    id: "hbm-cowos-crunch",
    label: "HBM and CoWoS crunch",
    description:
      "HBM3E and CoWoS capacity lag Blackwell and MI accelerator ramps for training and inference clusters.",
    impactOn: (node) =>
      [
        "tsmc",
        "sk-hynix",
        "micron",
        "samsung-memory",
        "ase",
        "amkor",
        "ibiden",
        "unimicron",
        "shinko",
        "nvidia-blackwell-gb200",
        "amd-instinct-mi-family"
      ].includes(node.id)
        ? 2
        : 1
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
        "nvidia-blackwell-gb200",
        "amd-instinct-mi-family",
        "cerebras-wse-cs",
        "sambanova-sn40l",
        "etched-sohu",
        "broadcom",
        "marvell",
        "tsmc",
        "sk-hynix",
        "micron",
        "samsung-memory",
        "oracle-cloud",
        "coreweave"
      ].includes(node.id)
        ? 1.6
        : 1
  }
];

const STRENGTH_ORDER: Strength[] = ["low", "medium", "high", "critical"];

const STRENGTH_WEIGHT_MULTIPLIER: Record<Strength, number> = {
  low: 1,
  medium: 1.15,
  high: 1.3,
  critical: 1.5
};

const ACCELERATOR_PLATFORM_IDS = new Set([
  "nvidia-blackwell-gb200",
  "amd-instinct-mi-family"
]);

const LEADING_EDGE_FOUNDRY_IDS = new Set([
  "tsmc",
  "samsung-foundry",
  "intel-foundry"
]);

const LITHO_EQUIPMENT_IDS = new Set(["asml", "nikon", "canon", "lasertec"]);

export function bumpStrength(strength: Strength, steps = 1): Strength {
  const index = STRENGTH_ORDER.indexOf(strength);
  if (index < 0) {
    return strength;
  }
  const bumped = Math.min(STRENGTH_ORDER.length - 1, index + steps);
  return STRENGTH_ORDER[bumped];
}

function bumpStrengthForAccelerators(
  edge: SupplyEdge
): ScenarioEdgeAdjustment | undefined {
  if (!ACCELERATOR_PLATFORM_IDS.has(edge.target)) {
    return undefined;
  }
  if (
    edge.relation !== "packages-for" &&
    edge.relation !== "supplies-substrates" &&
    edge.relation !== "manufactures-for"
  ) {
    return undefined;
  }
  return { strength: bumpStrength(edge.strength) };
}

function bumpStrengthForLithoEquipment(
  edge: SupplyEdge,
  graph: GraphData
): ScenarioEdgeAdjustment | undefined {
  if (edge.relation !== "supplies-equipment") {
    return undefined;
  }
  if (!LITHO_EQUIPMENT_IDS.has(edge.source)) {
    return undefined;
  }
  const target = graph.nodeById.get(edge.target);
  if (!target || !LEADING_EDGE_FOUNDRY_IDS.has(target.id)) {
    return undefined;
  }
  return { strength: bumpStrength(edge.strength) };
}

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

/**
 * Returns the adjusted edge strength under the active scenarios. When multiple
 * scenarios bump the same edge, the highest strength wins.
 */
export function adjustedEdgeStrength(
  edge: SupplyEdge,
  graph: GraphData,
  activeScenarioIds: string[]
): Strength {
  const scenarios = getActiveScenarios(activeScenarioIds);
  let strength: Strength = edge.strength;
  for (const scenario of scenarios) {
    const adjustment = scenario.edgeImpact?.(edge, graph);
    if (adjustment?.strength) {
      const candidateIndex = STRENGTH_ORDER.indexOf(adjustment.strength);
      const currentIndex = STRENGTH_ORDER.indexOf(strength);
      if (candidateIndex > currentIndex) {
        strength = adjustment.strength;
      }
    }
  }
  return strength;
}

/**
 * Returns the edge weight multiplier under active scenarios. The baseline is
 * the strength weight; scenario edge impacts may push it higher.
 */
export function scenarioEdgeWeightMultiplier(
  edge: SupplyEdge,
  graph: GraphData,
  activeScenarioIds: string[]
) {
  const adjustedStrength = adjustedEdgeStrength(edge, graph, activeScenarioIds);
  let weight = STRENGTH_WEIGHT_MULTIPLIER[adjustedStrength];
  for (const scenario of getActiveScenarios(activeScenarioIds)) {
    const adjustment = scenario.edgeImpact?.(edge, graph);
    if (adjustment?.weightMultiplier) {
      weight *= adjustment.weightMultiplier;
    }
  }
  return weight;
}

/**
 * Returns the total lead-time bump (in months) applied to the node by the
 * currently active scenarios.
 */
export function scenarioLeadTimeBumpMonths(
  node: SupplyNode,
  activeScenarioIds: string[]
) {
  return getActiveScenarios(activeScenarioIds).reduce((bump, scenario) => {
    const adjustment: ScenarioNodeAttributeAdjustment | undefined =
      scenario.nodeAttributeImpact?.(node);
    return bump + (adjustment?.leadTimeBumpMonths ?? 0);
  }, 0);
}
