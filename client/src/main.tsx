// src/main.tsx
//
// Entry point — runs once when the browser loads the app.
// Wraps everything in two providers:
//
// 1. QueryClientProvider — makes the TanStack Query cache available
//    to every component. When you call useQuery() inside any component,
//    it reads from this shared cache.
//
// 2. StrictMode — React renders your components twice in development
//    to surface bugs early (double-invokes render, useEffect, etc).
//    Has zero effect on production builds.

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,            // data is "fresh" for 60s — won't refetch
      retry: 2,                     // retry failed requests twice
      refetchOnWindowFocus: false,  // don't refetch when user alt-tabs back
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);