import { create } from "zustand";
import type { QuarterOrCurrent } from "../lib/history";

interface GraphState {
  activeScenarioIds: string[];
  selectedNodeId: string | null;
  currentQuarter: QuarterOrCurrent;
  setSelectedNode: (nodeId: string | null) => void;
  toggleScenario: (scenarioId: string) => void;
  setCurrentQuarter: (quarter: QuarterOrCurrent) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  activeScenarioIds: [],
  selectedNodeId: null,
  currentQuarter: "current",
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  toggleScenario: (scenarioId) =>
    set((state) => {
      const active = state.activeScenarioIds.includes(scenarioId);
      return {
        activeScenarioIds: active
          ? state.activeScenarioIds.filter((id) => id !== scenarioId)
          : [...state.activeScenarioIds, scenarioId]
      };
    }),
  setCurrentQuarter: (quarter) => set({ currentQuarter: quarter })
}));
