import type {
  HealthResponse,
  SimulationCommandResponse,
  SimulationStatus,
} from "@/types/simulation";

class SimulationApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SimulationApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // Keep the HTTP status message when the backend has no JSON error body.
    }

    throw new SimulationApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

const command = (path: string) =>
  request<SimulationCommandResponse>(`simulation/${path}`, {
    method: "POST",
  });

export const simulationApi = {
  health: (signal?: AbortSignal) =>
    request<HealthResponse>("health", { signal }),
  status: (signal?: AbortSignal) =>
    request<SimulationStatus>("simulation/status", { signal }),
  start: (visualization: boolean) =>
    request<SimulationCommandResponse>("simulation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visualization }),
    }),
  pause: () => command("pause"),
  resume: () => command("resume"),
  reset: () => command("reset"),
  stop: () => command("stop"),
};

export { SimulationApiError };
