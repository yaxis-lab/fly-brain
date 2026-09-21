import { SimulationState } from "@/types/simulation";

export const stateMeta: Record<
  SimulationState,
  { label: string; description: string; color: string; dot: string }
> = {
  idle: {
    label: "Ready",
    description: "Runtime is ready to initialize",
    color: "text-slate-600",
    dot: "bg-slate-400",
  },
  starting: {
    label: "Starting",
    description: "Loading the simulation backend",
    color: "text-amber-700",
    dot: "bg-amber-500",
  },
  running: {
    label: "Running",
    description: "Simulation is advancing in real time",
    color: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  paused: {
    label: "Paused",
    description: "State is held at the current timestep",
    color: "text-sky-700",
    dot: "bg-sky-500",
  },
  resetting: {
    label: "Resetting",
    description: "Restoring the initial network state",
    color: "text-violet-700",
    dot: "bg-violet-500",
  },
  stopping: {
    label: "Stopping",
    description: "Closing the simulation worker",
    color: "text-orange-700",
    dot: "bg-orange-500",
  },
  stopped: {
    label: "Stopped",
    description: "Runtime is closed and ready to start again",
    color: "text-slate-600",
    dot: "bg-slate-400",
  },
  error: {
    label: "Needs attention",
    description: "The simulation reported an error",
    color: "text-rose-700",
    dot: "bg-rose-500",
  },
};

export const transitionStates = new Set<SimulationState>([
  "starting",
  "resetting",
  "stopping",
]);
