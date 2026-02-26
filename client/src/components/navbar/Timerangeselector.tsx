// src/components/navbar/TimeRangeSelector.tsx
//
// The 1D / 1W / 1M / 3M / 1Y / 5Y toggle button group.
// Reads + writes selectedRange from the Zustand store.

import { clsx } from "clsx";
import { useTerminalStore } from "../../store/terminalStore";
import { TIME_RANGES } from "../../types";
import type { TimeRange } from "../../types";

export default function TimeRangeSelector() {
  const selectedRange = useTerminalStore((s) => s.selectedRange);
  const setRange = useTerminalStore((s) => s.setSelectedRange);

  return (
    // role="group" + aria-label: tells screen readers these buttons are related
    <div className="flex items-center gap-1" role="group" aria-label="Select time range">
      {TIME_RANGES.map((range: TimeRange) => {
        const isActive = range === selectedRange;
        return (
          <button
            key={range}
            onClick={() => setRange(range)}
            // aria-pressed: communicates toggle state to screen readers
            aria-pressed={isActive}
            aria-label={`Time range: ${range}`}
            className={clsx(
              "px-2.5 py-1 text-xs rounded border transition-all duration-150",
              isActive
                ? "bg-terminal-accent/15 border-terminal-accent/50 text-terminal-accent"
                : "bg-transparent border-white/15 text-white/50 hover:border-white/30 hover:text-white/70"
            )}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
}