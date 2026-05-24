import { useEffect, useRef, useState } from "react";
import { QUARTERS, type QuarterOrCurrent } from "../lib/history";
import { useGraphStore } from "../state/store";

// Order from oldest historical quarter to "current" (the live snapshot).
const TICKS: QuarterOrCurrent[] = [...QUARTERS, "current"];

const TICK_LABELS: Record<QuarterOrCurrent, string> = {
  "2025-Q3": "2025 Q3",
  "2025-Q4": "2025 Q4",
  "2026-Q1": "2026 Q1",
  "2026-Q2": "2026 Q2",
  current: "current"
};

const SHORT_LABELS: Record<QuarterOrCurrent, string> = {
  "2025-Q3": "Q3",
  "2025-Q4": "Q4",
  "2026-Q1": "Q1",
  "2026-Q2": "Q2",
  current: "now"
};

const PLAY_INTERVAL_MS = 1000;

export function HistorySlider() {
  const currentQuarter = useGraphStore((state) => state.currentQuarter);
  const setCurrentQuarter = useGraphStore((state) => state.setCurrentQuarter);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | null>(null);

  const index = TICKS.indexOf(currentQuarter);
  const safeIndex = index === -1 ? TICKS.length - 1 : index;

  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    playRef.current = window.setInterval(() => {
      const here = TICKS.indexOf(useGraphStore.getState().currentQuarter);
      const next = here === -1 ? 0 : here + 1;
      if (next >= TICKS.length) {
        setPlaying(false);
        setCurrentQuarter(TICKS[TICKS.length - 1]);
        return;
      }
      setCurrentQuarter(TICKS[next]);
    }, PLAY_INTERVAL_MS);

    return () => {
      if (playRef.current !== null) {
        window.clearInterval(playRef.current);
        playRef.current = null;
      }
    };
  }, [playing, setCurrentQuarter]);

  function handleSliderChange(event: React.ChangeEvent<HTMLInputElement>) {
    const target = Number(event.target.value);
    setCurrentQuarter(TICKS[target]);
  }

  function handleTogglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    // If we are at the end, rewind to the first historical quarter.
    if (safeIndex === TICKS.length - 1) {
      setCurrentQuarter(TICKS[0]);
    }
    setPlaying(true);
  }

  const isHistorical = currentQuarter !== "current";

  return (
    <section className="mt-5 rounded border border-[#d2cabd] bg-[#fbfaf6] p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">History</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-[#5f574e]">
            Scrub through quarterly chokepoint snapshots.
          </p>
        </div>
        <button
          aria-label={playing ? "Pause history playback" : "Play history"}
          className="rounded border border-[#a99d8f] bg-white px-2 py-1 text-xs font-semibold text-[#3a342c] hover:border-[#7b7064]"
          onClick={handleTogglePlay}
          type="button"
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>

      <input
        aria-label="Quarter selector"
        className="mt-3 w-full accent-[#0f766e]"
        list="history-ticks"
        max={TICKS.length - 1}
        min={0}
        onChange={handleSliderChange}
        step={1}
        type="range"
        value={safeIndex}
      />
      <datalist id="history-ticks">
        {TICKS.map((tick, idx) => (
          <option key={tick} label={SHORT_LABELS[tick]} value={idx} />
        ))}
      </datalist>

      <div className="mt-1 flex justify-between text-[10px] text-[#5f574e]">
        {TICKS.map((tick) => (
          <span
            className={
              tick === currentQuarter
                ? "font-semibold text-[#0f5f57]"
                : undefined
            }
            key={tick}
          >
            {SHORT_LABELS[tick]}
          </span>
        ))}
      </div>

      <div className="mt-3 rounded border border-[#e6dfd1] bg-[#f7f4ee] px-3 py-2 text-xs leading-5 text-[#4d4840]">
        <span className="font-semibold">{TICK_LABELS[currentQuarter]}</span>
        {isHistorical ? (
          <span className="ml-2 text-[#7b341e]">
            historical snapshot (synthetic data; see docs/scoring-history.md)
          </span>
        ) : (
          <span className="ml-2 text-[#5f574e]">
            live snapshot from nodes.csv
          </span>
        )}
      </div>
    </section>
  );
}
