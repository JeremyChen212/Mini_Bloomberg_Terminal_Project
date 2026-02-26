// src/components/navbar/Navbar.tsx
//
// The outer shell. Imports and arranges the four sub-components.
// No logic lives here — each piece of complexity is in its own file.
//
// Layout (left → right):
//   [TickerDisplay] | [SearchBar ──────────────] | [TimeRangeSelector] | [DatePicker]

import TickerDisplay from "./TickerDisplay";
import SearchBar from "./Searchbar";
import TimeRangeSelector from "./Timerangeselector";
import DatePicker from "./Datepicker";

export default function Navbar() {
  return (
    <header
      className="
        fixed top-0 left-0 right-0 z-50 h-[64px]
        bg-terminal-bg/95 backdrop-blur-sm
        border-b border-white/10
        flex items-center px-4 gap-4
      "
      // role="banner" marks this as the page header landmark.
      // Screen reader users can jump directly to it.
      role="banner"
    >

      {/* Current ticker — top left */}
      <TickerDisplay />

      {/* Visual divider — aria-hidden: purely decorative, not read aloud */}
      <div className="w-px h-8 bg-white/10" aria-hidden="true" />

      {/* Search — flex-1 makes it fill remaining space between dividers */}
      <SearchBar />

      <div className="w-px h-8 bg-white/10" aria-hidden="true" />

      {/* 1D / 1W / 1M / 3M / 1Y / 5Y toggles */}
      <TimeRangeSelector />

      <div className="w-px h-8 bg-white/10" aria-hidden="true" />

      {/* Calendar date picker — rightmost */}
      <DatePicker />

    </header>
  );
}