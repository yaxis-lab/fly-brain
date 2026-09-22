import asyncio
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from api.websocket.manager import SimulationWebSocketManager, _Client


logger = logging.getLogger(__name__)
router = APIRouter(tags=["simulation websocket"])


def get_websocket_manager(websocket: WebSocket) -> SimulationWebSocketManager:
    return websocket.app.state.websocket_manager


@router.websocket("/ws/simulation")
async def simulation_websocket(
    websocket: WebSocket,
    manager: SimulationWebSocketManager = Depends(get_websocket_manager),
) -> None:
    await websocket.accept()
    client: _Client | None = None

    try:
        client = manager.connect(asyncio.get_running_loop())
        while True:
            payload = await client.queue.get()
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        logger.debug("Simulation WebSocket client disconnected")
    except RuntimeError:
        logger.debug("Simulation WebSocket transport closed")
    finally:
        if client is not None:
            manager.disconnect(client)
