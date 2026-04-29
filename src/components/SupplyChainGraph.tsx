import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, {
  type Core,
  type EdgeSingular,
  type EventObject,
  type LayoutOptions,
  type NodeSingular
} from "cytoscape";
import fcose from "cytoscape-fcose";
import popper from "cytoscape-popper";
import { isEdgeSuppressedByScenarios } from "../lib/scenarios";
import { strengthWeight, type ScoreMap } from "../lib/scoring";
import type { GraphData, Strength } from "../lib/types";
import { useGraphStore } from "../state/store";
import { TYPE_COLORS } from "./Legend";

cytoscape.use(fcose);
cytoscape.use(popper);

interface SupplyChainGraphProps {
  graph: GraphData;
  scores: ScoreMap;
}

export function SupplyChainGraph({ graph, scores }: SupplyChainGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const activeScenarioIds = useGraphStore((state) => state.activeScenarioIds);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    score: number;
  } | null>(null);

  const elements = useMemo(
    () => [
      ...graph.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.name,
          score: scores.get(node.id) ?? 0,
          type: node.type
        }
      })),
      ...graph.edges.map((edge, index) => ({
        classes: isEdgeSuppressedByScenarios(edge, graph, activeScenarioIds)
          ? "suppressed"
          : "",
        data: {
          id: `${edge.source}-${edge.target}-${edge.relation}-${index}`,
          source: edge.source,
          target: edge.target,
          relation: edge.relation,
          strength: edge.strength
        }
      }))
    ],
    [activeScenarioIds, graph, scores]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      maxZoom: 2.4,
      minZoom: 0.2,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (element: NodeSingular) =>
              TYPE_COLORS[element.data("type") as keyof typeof TYPE_COLORS],
            "border-color": "#fefefe",
            "border-width": 2,
            color: "#1f1c18",
            "font-size": 9,
            "font-weight": 600,
            height: (element: NodeSingular) =>
              28 + Number(element.data("score")) * 0.24,
            label: "data(label)",
            "min-zoomed-font-size": 7,
            "overlay-opacity": 0,
            "text-background-color": "#fbfaf6",
            "text-background-opacity": 0.78,
            "text-background-padding": "2px",
            "text-margin-y": -8,
            "text-max-width": "82px",
            "text-valign": "top",
            "text-wrap": "wrap",
            width: (element: NodeSingular) =>
              28 + Number(element.data("score")) * 0.24
          }
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#111827",
            "border-width": 4
          }
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "line-color": "#9a9185",
            opacity: 0.42,
            "target-arrow-color": "#9a9185",
            "target-arrow-shape": "triangle",
            width: (element: EdgeSingular) =>
              0.8 + strengthWeight[element.data("strength") as Strength] * 0.85
          }
        },
        {
          selector: "edge[strength = 'critical']",
          style: {
            "line-color": "#7f1d1d",
            opacity: 0.72,
            "target-arrow-color": "#7f1d1d"
          }
        },
        {
          selector: "edge.suppressed",
          style: {
            "line-style": "dashed",
            opacity: 0.12
          }
        }
      ],
      wheelSensitivity: 0.18
    });

    cyRef.current = cy;
    cy.layout({
      name: "fcose",
      animate: false,
      fit: true,
      idealEdgeLength: 120,
      nodeSeparation: 90,
      packComponents: true,
      padding: 38,
      quality: "proof",
      randomize: false
    } as LayoutOptions).run();

    cy.on("tap", "node", (event: EventObject) => {
      const node = event.target as NodeSingular;
      setSelectedNode(node.id());
    });

    cy.on("tap", (event: EventObject) => {
      if (event.target === cy) {
        setSelectedNode(null);
      }
    });

    cy.on("mouseover", "node", (event: EventObject) => {
      const node = event.target as NodeSingular;
      const position = node.renderedPosition();
      setTooltip({
        x: position.x,
        y: position.y,
        label: node.data("label") as string,
        score: Number(node.data("score"))
      });
    });

    cy.on("mouseout", "node", () => setTooltip(null));

    const observer = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 38);
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, setSelectedNode]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.nodes().forEach((node) => {
      node.data("score", scores.get(node.id()) ?? 0);
      node.toggleClass("active-node", node.id() === selectedNodeId);
      if (node.id() === selectedNodeId) {
        node.select();
      } else {
        node.unselect();
      }
    });
  }, [scores, selectedNodeId]);

  return (
    <div className="relative h-full min-h-[620px]">
      <div className="absolute inset-0" ref={containerRef} />
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-20 rounded border border-[#b9ad9c] bg-[#fbfaf6] px-3 py-2 text-xs shadow-md"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div className="font-semibold">{tooltip.label}</div>
          <div className="mt-1 text-[#5f574e]">score {tooltip.score}</div>
        </div>
      ) : null}
    </div>
  );
}
