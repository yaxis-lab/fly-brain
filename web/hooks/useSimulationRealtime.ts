"use client";

import { useEffect, useState } from "react";

import { connectToSimulation } from "@/lib/simulation/realtime";
import type { SimulationRealtimeEvent } from "@/types/simulation";

export function useSimulationRealtime() {
  const [event, setEvent] = useState<SimulationRealtimeEvent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return connectToSimulation(setEvent, setConnected);
  }, []);

  return { event, connected };
}
