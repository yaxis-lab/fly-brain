"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { simulationApi } from "@/lib/simulation/api";
import type { SimulationState } from "@/types/simulation";

const statusKey = ["simulation", "status"] as const;
const healthKey = ["simulation", "health"] as const;

const activeStates = new Set<SimulationState>([
  "starting",
  "running",
  "paused",
  "resetting",
  "stopping",
]);

export function useSimulation() {
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: statusKey,
    queryFn: ({ signal }) => simulationApi.status(signal),
    refetchInterval: (query) =>
      activeStates.has(query.state.data?.state ?? "idle") ? 1000 : 5000,
  });

  const health = useQuery({
    queryKey: healthKey,
    queryFn: ({ signal }) => simulationApi.health(signal),
    refetchInterval: 15000,
  });

  const refreshStatus = () =>
    queryClient.invalidateQueries({ queryKey: statusKey });

  const start = useMutation({
    mutationFn: (visualization: boolean) => simulationApi.start(visualization),
    onSuccess: refreshStatus,
  });
  const pause = useMutation({
    mutationFn: simulationApi.pause,
    onSuccess: refreshStatus,
  });
  const resume = useMutation({
    mutationFn: simulationApi.resume,
    onSuccess: refreshStatus,
  });
  const reset = useMutation({
    mutationFn: simulationApi.reset,
    onSuccess: refreshStatus,
  });
  const stop = useMutation({
    mutationFn: simulationApi.stop,
    onSuccess: refreshStatus,
  });

  return {
    health,
    status,
    actions: { start, pause, resume, reset, stop },
    isActionPending:
      start.isPending ||
      pause.isPending ||
      resume.isPending ||
      reset.isPending ||
      stop.isPending,
  };
}
