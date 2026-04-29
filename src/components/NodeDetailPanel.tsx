import {
  getDependencyEdges,
  getDependentEdges,
  relatedNodeIdForEdge
} from "../lib/graph";
import type { GraphData, SourceRef, SupplyEdge, SupplyNode } from "../lib/types";
import type { ScoreMap } from "../lib/scoring";
import { ChokepointScoreBadge } from "./ChokepointScoreBadge";

interface NodeDetailPanelProps {
  graph: GraphData;
  node: SupplyNode | null;
  scores: ScoreMap;
  sources: Map<string, SourceRef>;
}

export function NodeDetailPanel({
  graph,
  node,
  scores,
  sources
}: NodeDetailPanelProps) {
  if (!node) {
    const topNodes = [...graph.nodes]
      .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
      .slice(0, 6);

    return (
      <aside className="border-t border-line bg-[#fbfaf6] p-4 lg:border-l lg:border-t-0">
        <h2 className="text-base font-semibold">Network summary</h2>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Metric label="nodes" value={graph.nodes.length.toString()} />
          <Metric label="edges" value={graph.edges.length.toString()} />
          <Metric label="types" value="10" />
        </dl>
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5f574e]">
            Highest chokepoint scores
          </h3>
          <div className="mt-3 space-y-2">
            {topNodes.map((topNode) => (
              <div
                className="flex items-center justify-between rounded border border-line bg-[#f7f4ee] px-3 py-2"
                key={topNode.id}
              >
                <span className="text-sm">{topNode.name}</span>
                <ChokepointScoreBadge score={scores.get(topNode.id) ?? 0} size="sm" />
              </div>
            ))}
          </div>
        </section>
      </aside>
    );
  }

  const dependencies = getDependencyEdges(graph, node.id);
  const dependents = getDependentEdges(graph, node.id);
  const connectedSourceIds = new Set([
    node.source_id,
    ...dependencies.map((edge) => edge.source_id),
    ...dependents.map((edge) => edge.source_id)
  ]);

  return (
    <aside className="border-t border-line bg-[#fbfaf6] p-4 lg:border-l lg:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b341e]">
            {node.type}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{node.name}</h2>
        </div>
        <ChokepointScoreBadge score={scores.get(node.id) ?? 0} size="lg" />
      </div>

      <p className="mt-3 text-sm leading-6 text-[#4d4840]">{node.short_description}</p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label="country" value={node.country} />
        <Metric label="city" value={node.city} />
        <Metric label="ticker" value={node.public_ticker || "private"} />
        <Metric label="founded" value={node.founded.toString()} />
      </dl>

      <EdgeList
        edges={dependencies}
        graph={graph}
        heading="Dependencies"
        mode="dependency"
        nodeId={node.id}
      />
      <EdgeList
        edges={dependents}
        graph={graph}
        heading="Dependents"
        mode="dependent"
        nodeId={node.id}
      />

      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5f574e]">
          Sources
        </h3>
        <ul className="mt-3 space-y-2 text-xs leading-5">
          {[...connectedSourceIds].map((sourceId) => {
            const source = sources.get(sourceId);

            return (
              <li key={sourceId}>
                {source ? (
                  <a
                    className="text-[#0f5f57] underline decoration-[#9bc5be] underline-offset-4 hover:text-[#0b423d]"
                    href={source.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {source.id}: {source.label}
                  </a>
                ) : (
                  <span>{sourceId}: missing source</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-[#f7f4ee] px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6258]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}

function EdgeList({
  edges,
  graph,
  heading,
  mode,
  nodeId
}: {
  edges: SupplyEdge[];
  graph: GraphData;
  heading: string;
  mode: "dependency" | "dependent";
  nodeId: string;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5f574e]">
        {heading}
      </h3>
      <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
        {edges.length === 0 ? (
          <p className="text-sm text-[#6b6258]">None in this curated graph.</p>
        ) : (
          edges.map((edge) => {
            const relatedId = relatedNodeIdForEdge(edge, nodeId, mode);
            const related = graph.nodeById.get(relatedId);

            return (
              <div
                className="rounded border border-line bg-[#f7f4ee] px-3 py-2 text-sm"
                key={`${edge.source}-${edge.target}-${edge.relation}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">
                    {related?.name ?? relatedId}
                  </span>
                  <span className="rounded bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#5f574e]">
                    {edge.strength}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#5f574e]">
                  {edge.relation}: {edge.notes}
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
