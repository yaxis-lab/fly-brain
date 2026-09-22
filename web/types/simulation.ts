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

export interface FlyState {
  body_positions: number[][];
  body_rotations: number[][];
  joint_angles: number[];
}

export interface SimulationRealtimeScene {
  body_segments: Array<{
    name: string;
    asset: string;
    mirror_y: boolean;
    material: string;
  }>;
  root_segment: string;
  ground: {
    size: number[];
    position: number[];
    checker_a: number[];
    checker_b: number[];
    repeat: number;
  };
  camera: {
    position: number[];
    rotation_matrix: number[][];
    fov: number;
  };
  lights: Array<{
    position: number[];
    direction: number[];
    diffuse: number[];
    ambient: number[];
    specular: number[];
  }>;
}

export interface SimulationRealtimeEvent {
  type: "simulation_status" | "simulation_update";
  status: SimulationState;
  message: string;
  updated_at: string;
  simulation_time: number;
  fly_state: FlyState | null;
  spike_ids: number[];
  spike_count: number;
  active_neuron_count: number;
  total_spike_count: number;
  scene: SimulationRealtimeScene | null;
}
