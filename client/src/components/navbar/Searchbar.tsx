// src/components/navbar/SearchBar.tsx
//
// Search input with live dropdown results.
// - Filters the hardcoded MOCK_COMPANIES list as the user types
// - Keyboard navigation: ArrowUp/Down to move, Enter to select, Escape to close
// - "/" shortcut: press "/" anywhere on the page to focus this input
// - Click outside closes the dropdown
//
// When backend is ready: replace searchCompanies() body only.
// This component never changes.

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { useTerminalStore } from "../../store/terminalStore";
import { searchCompanies } from "../..//mocks/tickers";
import type { Company } from "../..//types";

export default function SearchBar() {
  const setTicker = useTerminalStore((s) => s.setTicker);

  // ── Local state ─────────────────────────────────────────────────────────
  // None of these need to be in global state — only SearchBar cares about them.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // activeIndex tracks which result is keyboard-highlighted (-1 = none)
  const [activeIndex, setActiveIndex] = useState(-1);

  // ── Refs ─────────────────────────────────────────────────────────────────
  // useRef gives a direct DOM pointer without causing re-renders on change.
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    // Cleanup: remove listener when component unmounts (prevents memory leaks)
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []); // [] = attach once on mount, remove on unmount

  // ── "/" keyboard shortcut ────────────────────────────────────────────────
  useEffect(() => {
    function onSlash(e: KeyboardEvent) {
      // Guard: don't steal focus if user is already in an input
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onSlash);
    return () => document.removeEventListener("keydown", onSlash);
  }, []);

  // ── Search logic ─────────────────────────────────────────────────────────
  // useCallback: memoizes this function so it's stable across renders.
  // Required because it's listed in the useEffect dependency array below.
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const found = await searchCompanies(q);
      setResults(found);
      setIsOpen(true);
      setActiveIndex(-1);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Debounced search ─────────────────────────────────────────────────────
  // Debounce: wait 250ms after user stops typing before searching.
  // Without debounce: typing "AAPL" fires 4 requests (A → AA → AAP → AAPL).
  // With debounce: fires 1 request after the user pauses.
  //
  // How the cleanup works:
  //   1. User types "A" → timer starts (250ms)
  //   2. User types "A" again before 250ms → cleanup cancels timer, new timer starts
  //   3. User pauses 250ms → timer fires → performSearch("AA") runs
  useEffect(() => {
    const timer = setTimeout(() => void performSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // ── Select a result ───────────────────────────────────────────────────────
  function selectCompany(company: Company) {
    setTicker(company.ticker, company.name); // update global store → TickerDisplay reacts
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault(); // prevent cursor moving to end of input
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          selectCompany(results[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="relative flex-1 max-w-[480px]" ref={containerRef}>

      {/* ── Input ── */}
      <div className="relative">
        {/* Spinner while searching, otherwise magnifier icon */}
        {isLoading ? (
          <Loader2
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-terminal-accent animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"
            aria-hidden="true"
          />
        )}

        <input
          ref={inputRef}
          id="terminal-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search for a name, ticker, or function"
          autoComplete="off"
          spellCheck={false}
          // ARIA: tells screen readers this is a combobox with a listbox dropdown
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="search-listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
          }
          aria-label="Search tickers and companies. Press Enter to select."
          className="
            w-full bg-white/5 border border-white/15 rounded
            pl-9 pr-10 py-1.5 text-xs text-white/70
            placeholder:text-white/25
            focus:outline-none focus:border-terminal-accent/50 focus:bg-white/[0.08]
            transition-colors duration-150
          "
        />

        {/* Clear button — only visible when there's text */}
        {query && !isLoading && (
          <button
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        )}

        {/* "/" shortcut hint — only visible when input is empty */}
        {!query && (
          <kbd
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 border border-white/20 rounded px-1"
            aria-hidden="true"
          >
            /
          </kbd>
        )}
      </div>

      {/* ── Dropdown ── */}
      {isOpen && (
        <ul
          id="search-listbox"
          role="listbox"
          aria-label="Search results"
          className="
            absolute top-[calc(100%+6px)] left-0 right-0 z-50
            bg-terminal-surface border border-white/15 rounded-lg
            shadow-2xl overflow-hidden
          "
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-xs text-white/40" aria-live="polite">
              No results for &ldquo;{query}&rdquo;
            </li>
          ) : (
            results.map((company, index) => {
              const isHighlighted = index === activeIndex;
              return (
                <li
                  key={company.ticker}
                  id={`search-result-${index}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onClick={() => selectCompany(company)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors text-xs",
                    isHighlighted
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5"
                  )}
                >
                  {/* w-14 shrink-0: fixed width so names always align */}
                  <span className="text-terminal-positive font-bold w-14 shrink-0">
                    {company.ticker}
                  </span>
                  <span className="flex-1 truncate">{company.name}</span>
                  <span className="text-white/30 text-[10px] shrink-0 hidden sm:block">
                    {company.sector}
                  </span>
                  <span className="text-white/20 text-[10px] border border-white/10 rounded px-1 shrink-0">
                    {company.exchange}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}