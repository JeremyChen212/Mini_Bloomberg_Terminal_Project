import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// delete this line → import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
