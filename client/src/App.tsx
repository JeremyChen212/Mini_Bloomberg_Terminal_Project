import { useState } from "react";
import TopBar from "./components/TopBar";
// import Dashboard from "./pages/Dashboard";

// App.tsx is the "owner" of global state.
// Any piece of data that multiple components need lives here.
// It gets passed DOWN as props to children who need it.
//
// Rule of thumb: if only ONE component needs a piece of state,
// keep it inside that component. Only lift it up when siblings
// need to share it.

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

export interface AppState {
  ticker: string;           // e.g. "AAPL" — drives ALL data fetching below
  companyName: string;      // e.g. "Apple Inc."
  selectedRange: TimeRange; // drives chart + news date window
  selectedDate: Date;       // specific date from calendar picker
}

export default function App() {
  // These 4 pieces of state are "global" to the app.
  // TopBar can change them. Dashboard reads them.
  const [ticker, setTicker] = useState<string>("AAPL");
  const [companyName, setCompanyName] = useState<string>("Apple Inc.");
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1M");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // When user searches a new ticker in TopBar:
  // 1. TopBar calls onTickerChange("TSLA", "Tesla Inc.")
  // 2. App updates state
  // 3. React re-renders Dashboard with new ticker
  // 4. Dashboard's useQuery hooks refetch with the new ticker
  // This is the "unidirectional data flow" pattern in React.
  const handleTickerChange = (newTicker: string, newCompanyName: string) => {
    setTicker(newTicker);
    setCompanyName(newCompanyName);
  };

  return (
    // min-h-screen: at least full viewport height
    // bg-[#0a0a0f]: near-black terminal background from wireframe
    // font-mono: monospace gives Bloomberg terminal feel
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">
      <TopBar
        ticker={ticker}
        companyName={companyName}
        selectedRange={selectedRange}
        selectedDate={selectedDate}
        onTickerChange={handleTickerChange}
        onRangeChange={setSelectedRange}
        onDateChange={setSelectedDate}
      />

      {/* Main scrollable content below the fixed TopBar */}
      <main className="pt-[64px] px-4 pb-8">
        {/* <Dashboard
          ticker={ticker}
          selectedRange={selectedRange}
          selectedDate={selectedDate}
        /> */}
      </main>
    </div>
  );
}