import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OrbitViewer } from "../app/OrbitViewer";
import "../app/globals.css";
import "./pages.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OrbitViewer />
  </StrictMode>,
);
