from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.core.logging import configure_logging
from api.routes.health import router as health_router
from api.routes.simulation import router as simulation_router
from api.simulation.manager import SimulationManager
from api.websocket.manager import SimulationWebSocketManager
from api.websocket.router import simulation_websocket


configure_logging()


app = FastAPI(
    title="Fly Brain Simulation API",
    version="1.0.0",
    description=(
        "REST API for controlling the FlyGym, FlyVis, and Brian2 simulation "
        "lifecycle.\n\n"
        "## Realtime simulation stream\n\n"
        "Connect a WebSocket client to `ws://localhost:8000/ws/simulation` "
        "to observe simulation lifecycle events and batched realtime updates. "
        "REST endpoints remain responsible for starting, pausing, resuming, "
        "resetting, and stopping the simulation.\n\n"
        "Realtime update messages include `simulation_time`, `fly_state`, "
        "`spike_ids`, `spike_count`, `active_neuron_count`, "
        "`total_spike_count`, and `status`. `spike_ids` contains the neurons "
        "that fired during the current stream interval.\n\n"
        "Use `wss://<host>/ws/simulation` when the API is served over HTTPS."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulation_manager = SimulationManager()
websocket_manager = SimulationWebSocketManager(simulation_manager.status)
simulation_manager.add_observer(websocket_manager.publish)

app.state.simulation_manager = simulation_manager
app.state.websocket_manager = websocket_manager
app.include_router(health_router)
app.include_router(simulation_router)
app.add_api_websocket_route("/ws/simulation", simulation_websocket)
