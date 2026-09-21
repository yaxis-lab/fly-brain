import type { Metadata } from "next";

import { SimulationDashboard } from "@/components/simulation/SimulationDashboard";

export const metadata: Metadata = {
  title: "Simulations · FlyBrain",
  description: "Control and monitor the MaleCNS simulation runtime.",
};

export default function SimulationsPage() {
  return <SimulationDashboard />;
}
