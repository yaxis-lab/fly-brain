import type { Metadata } from "next";

import { SimulationDashboard } from "@/components/simulation/SimulationDashboard";

export const metadata: Metadata = {
  title: "Simulations · FlyBrain",
  description: "Explore a live MuJoCo FlyGym simulation in a Three.js browser scene.",
};

export default function SimulationsPage() {
  return <SimulationDashboard />;
}
