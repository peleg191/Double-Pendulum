import type { Metadata } from "next";
import { OrbitViewer } from "./OrbitViewer";

export const metadata: Metadata = {
  title: "Lyapunov Orbit Viewer",
  description:
    "Interactive supplementary viewer for precomputed double-pendulum Lyapunov periodic orbits.",
};

export default function Home() {
  return <OrbitViewer />;
}
