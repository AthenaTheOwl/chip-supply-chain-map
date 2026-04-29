import { create } from "zustand";

interface GraphState {
  activeScenarioIds: string[];
  selectedNodeId: string | null;
  setSelectedNode: (nodeId: string | null) => void;
  toggleScenario: (scenarioId: string) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  activeScenarioIds: [],
  selectedNodeId: null,
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  toggleScenario: (scenarioId) =>
    set((state) => {
      const active = state.activeScenarioIds.includes(scenarioId);
      return {
        activeScenarioIds: active
          ? state.activeScenarioIds.filter((id) => id !== scenarioId)
          : [...state.activeScenarioIds, scenarioId]
      };
    })
}));
