import { useMemo } from "react";
import { Header } from "./components/Header";
import { Legend } from "./components/Legend";
import { NodeDetailPanel } from "./components/NodeDetailPanel";
import { ScenarioControls } from "./components/ScenarioControls";
import { SupplyChainGraph } from "./components/SupplyChainGraph";
import { graphData, sourceRefs } from "./lib/graph";
import { getScoreMapForQuarter } from "./lib/history";
import { computeChokepointScores } from "./lib/scoring";
import { useGraphStore } from "./state/store";

export default function App() {
  const activeScenarioIds = useGraphStore((state) => state.activeScenarioIds);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const currentQuarter = useGraphStore((state) => state.currentQuarter);

  const liveScores = useMemo(
    () => computeChokepointScores(graphData, activeScenarioIds),
    [activeScenarioIds]
  );

  const scores = useMemo(() => {
    if (currentQuarter === "current") {
      return liveScores;
    }
    const historical = getScoreMapForQuarter(currentQuarter);
    if (historical.size === 0) {
      return liveScores;
    }
    const merged = new Map(liveScores);
    historical.forEach((value, id) => merged.set(id, value));
    return merged;
  }, [currentQuarter, liveScores]);

  const selectedNode =
    graphData.nodes.find((node) => node.id === selectedNodeId) ?? null;

  return (
    <div className="min-h-screen bg-[#ece7dd] text-ink">
      <Header />
      <main className="grid min-h-[calc(100vh-76px)] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <ScenarioControls />
        <section className="relative min-h-[620px] border-y border-line bg-[#f9f7f1] lg:border-x lg:border-y-0">
          <SupplyChainGraph
            graph={graphData}
            quarter={currentQuarter}
            scores={liveScores}
          />
          <Legend />
        </section>
        <NodeDetailPanel
          graph={graphData}
          node={selectedNode}
          scores={scores}
          sources={sourceRefs}
        />
      </main>
    </div>
  );
}
