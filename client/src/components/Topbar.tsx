import { useState, useRef, useEffect } from "react";
import { Search, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns";
import type { TimeRange } from "../../App";

// ---------------------------------------------------------
// TYPES — define the "contract" for this component's props.
// Anyone who uses <TopBar /> must pass exactly these props.
// TypeScript will error if they pass wrong types or miss one.
// ---------------------------------------------------------
interface TopBarProps {
  ticker: string;
  companyName: string;
  selectedRange: TimeRange;
  selectedDate: Date;
  onTickerChange: (ticker: string, companyName: string) => void;
  onRangeChange: (range: TimeRange) => void;
  onDateChange: (date: Date) => void;
}

// The time range buttons from the wireframe: [1D, 1W, 1M, 3M, 1Y, 5Y]
// Defined as a const array outside the component — no reason for it
// to live inside since it never changes.
const TIME_RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y"];

export default function TopBar({
  ticker,
  companyName,
  selectedRange,
  selectedDate,
  onTickerChange,
  onRangeChange,
  onDateChange,
}: TopBarProps) {
  // Local state: only this component cares about these values.
  // They don't need to be in App.tsx because nothing else reads them.
  const [searchValue, setSearchValue] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // useRef gives you a reference to a real DOM element.
  // Here we use it to detect clicks OUTSIDE the calendar
  // so we can close it — classic "click outside to dismiss" pattern.
  const calendarRef = useRef<HTMLDivElement>(null);

  // useEffect runs AFTER the component renders.
  // This one attaches a global click listener and cleans it up
  // when the component unmounts (the return function).
  // The [] dependency array means: run once on mount, clean up on unmount.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut: pressing "/" focuses the search input (Bloomberg-style)
  useEffect(() => {
    function handleSlash(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        document.getElementById("terminal-search")?.focus();
      }
    }
    document.addEventListener("keydown", handleSlash);
    return () => document.removeEventListener("keydown", handleSlash);
  }, []);

  // Handle search submission.
  // In the real app, this would call your /api/search?q=AAPL endpoint.
  // For now it just uppercases the input and calls the parent's handler.
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      const upperTicker = searchValue.trim().toUpperCase();
      onTickerChange(upperTicker, upperTicker); // real app would resolve company name from API
      setSearchValue("");
    }
  };

  // Build the calendar grid for the current month.
  // date-fns makes this clean — eachDayOfInterval returns an array of Date objects.
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth),
  });

  // Pad the start of the grid so days align under correct weekday headers.
  // getDay() returns 0=Sun ... 6=Sat, but our calendar starts on Mon,
  // so we adjust: Mon=0, Tue=1 ... Sun=6
  const startPadding = (startOfMonth(calendarMonth).getDay() + 6) % 7;

  return (
    // fixed + top-0 + z-50: sticks to top of screen, always above content
    // border-b: subtle separator line below navbar
    // backdrop-blur: frosted glass effect if content scrolls under it
    <header className="fixed top-0 left-0 right-0 z-50 h-[64px] bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/10 flex items-center px-4 gap-4">

      {/* ── TICKER DISPLAY ── */}
      {/* The current company shown in top-left, matching wireframe */}
      <div className="flex items-center gap-2 min-w-[160px] border border-white/20 rounded px-3 py-1.5 bg-white/5">
        <span className="text-[#4ade80] font-bold text-sm tracking-widest">{ticker}</span>
        <span className="text-white/60 text-xs truncate">{companyName}</span>
      </div>

      {/* ── DIVIDER ── */}
      <div className="w-px h-8 bg-white/10" />

      {/* ── SEARCH BAR ── */}
      {/* relative + absolute: positions the "/" badge and search icon inside the input */}
      <div className="relative flex-1 max-w-[480px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <input
          id="terminal-search"
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Search for a name, ticker, or function"
          className="
            w-full bg-white/5 border border-white/15 rounded
            pl-9 pr-10 py-1.5 text-xs text-white/70
            placeholder:text-white/25
            focus:outline-none focus:border-[#4ade80]/50 focus:bg-white/8
            transition-colors duration-150
          "
        />
        {/* The "/" shortcut badge on the right of the input, from wireframe */}
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 border border-white/20 rounded px-1">
          /
        </kbd>
      </div>

      {/* ── DIVIDER ── */}
      <div className="w-px h-8 bg-white/10" />

      {/* ── TIME RANGE BUTTONS ── */}
      {/* Maps over TIME_RANGES array to render each button.
          The selected one gets a highlighted style. */}
      <div className="flex items-center gap-1">
        {TIME_RANGES.map((range) => (
          <button
            key={range}
            onClick={() => onRangeChange(range)}
            className={`
              px-2.5 py-1 text-xs rounded border transition-all duration-150
              ${selectedRange === range
                ? "bg-[#4ade80]/15 border-[#4ade80]/50 text-[#4ade80]"  // active state
                : "bg-transparent border-white/15 text-white/50 hover:border-white/30 hover:text-white/70"
              }
            `}
          >
            {range}
          </button>
        ))}
      </div>

      {/* ── DIVIDER ── */}
      <div className="w-px h-8 bg-white/10" />

      {/* ── DATE PICKER ── */}
      {/* ref={calendarRef} is what the click-outside effect checks */}
      <div className="relative" ref={calendarRef}>
        <button
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          className="flex items-center gap-2 border border-white/15 rounded px-3 py-1.5 text-xs text-white/60 hover:border-white/30 hover:text-white/80 transition-colors"
        >
          {format(selectedDate, "MMMM dd, yyyy")}
          <Calendar className="w-3.5 h-3.5" />
        </button>

        {/* Calendar dropdown — only renders when isCalendarOpen is true */}
        {isCalendarOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] w-[280px] bg-[#111118] border border-white/15 rounded-lg p-4 shadow-2xl">

            {/* Month navigation header */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                <ChevronLeft className="w-4 h-4 text-white/50 hover:text-white transition-colors" />
              </button>
              <span className="text-sm text-white font-medium">
                {format(calendarMonth, "MMM yyyy")}
              </span>
              <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                <ChevronRight className="w-4 h-4 text-white/50 hover:text-white transition-colors" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="text-center text-[10px] text-white/30 pb-1">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            {/* startPadding empty cells push the first day to the right column */}
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {daysInMonth.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, calendarMonth);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      onDateChange(day);
                      setIsCalendarOpen(false);
                    }}
                    className={`
                      text-center text-xs py-1.5 rounded transition-all
                      ${isSelected
                        ? "bg-[#4ade80] text-black font-bold"
                        : isCurrentMonth
                          ? "text-white/70 hover:bg-white/10"
                          : "text-white/20"
                      }
                    `}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}