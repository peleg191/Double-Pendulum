import type { Metadata } from "next";
import { OrbitViewer } from "./OrbitViewer";

export const metadata: Metadata = {
  title: "Saddle Orbit For the Egalitarian Double Pendulum",
  description:
    "Interactive viewer for precomputed saddle orbits of the egalitarian double pendulum.",
};

export default function Home() {
  return <OrbitViewer />;
}
