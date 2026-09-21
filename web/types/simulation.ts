export const simulationStates = [
  "idle",
  "starting",
  "running",
  "paused",
  "resetting",
  "stopping",
  "stopped",
  "error",
] as const;

export type SimulationState = (typeof simulationStates)[number];

export interface SimulationStatus {
  state: SimulationState;
  simulation_time: number;
  message: string;
  error: string | null;
  updated_at: string;
  started_at: string | null;
}

export interface SimulationCommandResponse {
  state: SimulationState;
  message: string;
  status_url: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}
