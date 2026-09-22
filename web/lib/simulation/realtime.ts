import type { SimulationRealtimeEvent } from "@/types/simulation";

const defaultBackendUrl = "http://127.0.0.1:8000";

function websocketUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_FLY_BRAIN_WS_URL ??
    process.env.NEXT_PUBLIC_FLY_BRAIN_API_URL ??
    defaultBackendUrl;

  const url = configuredUrl.replace(/^http/, "ws").replace(/\/$/, "");
  return `${url}/ws/simulation`;
}

export function connectToSimulation(
  onEvent: (event: SimulationRealtimeEvent) => void,
  onConnectionChange: (connected: boolean) => void,
) {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closedByClient = false;

  const connect = () => {
    socket = new WebSocket(websocketUrl());

    socket.onopen = () => onConnectionChange(true);
    socket.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data) as SimulationRealtimeEvent);
      } catch {
        // Ignore malformed frames and keep the stream alive.
      }
    };
    socket.onclose = () => {
      onConnectionChange(false);
      if (!closedByClient) {
        reconnectTimer = setTimeout(connect, 2000);
      }
    };
    socket.onerror = () => socket?.close();
  };

  connect();

  return () => {
    closedByClient = true;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
    }
    socket?.close();
  };
}
