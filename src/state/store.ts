import { create } from "zustand";
import type { QuarterOrCurrent } from "../lib/history";

export const MAX_WATCHLIST_SIZE = 8;

interface GraphState {
  activeScenarioIds: string[];
  selectedNodeId: string | null;
  currentQuarter: QuarterOrCurrent;
  watchlistNodeIds: string[];
  setSelectedNode: (nodeId: string | null) => void;
  toggleScenario: (scenarioId: string) => void;
  setCurrentQuarter: (quarter: QuarterOrCurrent) => void;
  addWatchlistNode: (nodeId: string) => void;
  removeWatchlistNode: (nodeId: string) => void;
  toggleWatchlistNode: (nodeId: string) => void;
  clearWatchlist: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  activeScenarioIds: [],
  selectedNodeId: null,
  currentQuarter: "current",
  watchlistNodeIds: [],
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
  setCurrentQuarter: (quarter) => set({ currentQuarter: quarter }),
  addWatchlistNode: (nodeId) =>
    set((state) => {
      if (
        state.watchlistNodeIds.includes(nodeId) ||
        state.watchlistNodeIds.length >= MAX_WATCHLIST_SIZE
      ) {
        return {};
      }
      return { watchlistNodeIds: [...state.watchlistNodeIds, nodeId] };
    }),
  removeWatchlistNode: (nodeId) =>
    set((state) => ({
      watchlistNodeIds: state.watchlistNodeIds.filter((id) => id !== nodeId)
    })),
  toggleWatchlistNode: (nodeId) =>
    set((state) => {
      if (state.watchlistNodeIds.includes(nodeId)) {
        return {
          watchlistNodeIds: state.watchlistNodeIds.filter((id) => id !== nodeId)
        };
      }
      if (state.watchlistNodeIds.length >= MAX_WATCHLIST_SIZE) {
        return {};
      }
      return { watchlistNodeIds: [...state.watchlistNodeIds, nodeId] };
    }),
  clearWatchlist: () => set({ watchlistNodeIds: [] })
}));
