from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
import logging
from threading import Lock
from typing import Any

from api.schemas.simulation import SimulationStatus
from api.schemas.websocket import SimulationRealtimeEvent
from api.websocket.events import status_event, update_event


logger = logging.getLogger(__name__)

EventPayload = dict[str, Any]
StatusProvider = Callable[[], SimulationStatus]


@dataclass(eq=False)
class _Client:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[EventPayload]
    active: bool = True

    def enqueue(self, payload: EventPayload) -> None:
        if not self.active:
            return

        if self.queue.full():
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass

        try:
            self.queue.put_nowait(payload)
        except asyncio.QueueFull:
            # A second publisher callback can race with the first callback in
            # the event loop. Dropping this update preserves bounded memory.
            pass


class SimulationWebSocketManager:
    def __init__(
        self,
        status_provider: StatusProvider,
        *,
        queue_size: int = 32,
    ) -> None:
        self._status_provider = status_provider
        self._queue_size = queue_size
        self._clients: set[_Client] = set()
        self._lock = Lock()
        self._last_event: SimulationRealtimeEvent | None = None

    def connect(self, loop: asyncio.AbstractEventLoop) -> _Client:
        client = _Client(
            loop=loop,
            queue=asyncio.Queue(maxsize=self._queue_size),
        )
        with self._lock:
            self._clients.add(client)
            initial_event = self._last_event

        if initial_event is None:
            initial_event = status_event(self._status_provider())
            with self._lock:
                if self._last_event is None:
                    self._last_event = initial_event

        client.enqueue(initial_event.model_dump(mode="json"))
        return client

    def disconnect(self, client: _Client) -> None:
        with self._lock:
            client.active = False
            self._clients.discard(client)

    def publish(
        self,
        status: SimulationStatus,
        observation: Mapping[str, Any] | None = None,
    ) -> None:
        try:
            with self._lock:
                previous = self._last_event
                event = (
                    update_event(status, observation, previous)
                    if observation is not None
                    else status_event(status, previous)
                )
                self._last_event = event
                clients = tuple(self._clients)

            payload = event.model_dump(mode="json")
            for client in clients:
                if client.active:
                    client.loop.call_soon_threadsafe(client.enqueue, payload)
        except Exception:
            # Observation delivery is auxiliary; it must never change the
            # simulation worker's lifecycle.
            logger.exception("Failed to publish simulation WebSocket event")
