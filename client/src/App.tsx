// src/App.tsx
//
// Root layout with login gate.
// Shows LoginPage first; after sign-in, renders the terminal dashboard.

import { useState } from "react";
import Navbar     from "./components/navbar/Navbar";
import Dashboard  from "./components/layout/Dashboard";
import LoginPage  from "./pages/LoginPage";

const AUTH_KEY = "pluto-auth";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => localStorage.getItem(AUTH_KEY) === "true"
  );

  const handleLogin = () => {
    localStorage.setItem(AUTH_KEY, "true");
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-white font-mono">

      {/* Fixed navbar — 64px tall */}
      <Navbar />

      {/*
        pt-16 = 64px = exactly the navbar height
        px-4 py-4 = breathing room around the panels
      */}
      <main className="pt-16 px-4 py-4" id="main-content">
        <Dashboard />
      </main>

    </div>
  );
}