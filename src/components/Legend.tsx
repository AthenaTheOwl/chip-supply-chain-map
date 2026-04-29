import { type NodeType } from "../lib/types";

export const TYPE_COLORS: Record<NodeType, string> = {
  foundry: "#0f766e",
  fabless: "#2f5597",
  "eda-ip": "#6d28d9",
  equipment: "#b45309",
  materials: "#7f1d1d",
  substrates: "#64748b",
  memory: "#9333ea",
  "osat-packaging": "#be123c",
  hyperscaler: "#1d4ed8",
  "auto-industrial": "#3f6212"
};

const labels: Record<NodeType, string> = {
  foundry: "Foundry",
  fabless: "Fabless",
  "eda-ip": "EDA/IP",
  equipment: "Equipment",
  materials: "Materials",
  substrates: "Substrates",
  memory: "Memory",
  "osat-packaging": "OSAT/package",
  hyperscaler: "Hyperscaler",
  "auto-industrial": "Auto/industrial"
};

export function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 max-w-[calc(100%-2rem)] rounded border border-line bg-[#fbfaf6]/95 p-3 shadow-sm backdrop-blur">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {(Object.keys(TYPE_COLORS) as NodeType[]).map((type) => (
          <div className="flex items-center gap-2" key={type}>
            <span
              className="h-3 w-3 rounded-full border border-black/10"
              style={{ backgroundColor: TYPE_COLORS[type] }}
            />
            <span className="whitespace-nowrap text-[#4d4840]">{labels[type]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
