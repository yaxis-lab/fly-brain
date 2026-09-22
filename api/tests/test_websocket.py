from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from threading import Event

from api.schemas.simulation import SimulationState, SimulationStatus
from api.websocket.manager import SimulationWebSocketManager
from api.simulation.worker import SimulationWorker


def make_status(
    state: SimulationState = SimulationState.RUNNING,
    simulation_time: float = 0.0,
) -> SimulationStatus:
    return SimulationStatus(
        state=state,
        simulation_time=simulation_time,
        message=f"Simulation is {state.value}",
        updated_at=datetime.now(timezone.utc),
    )


def test_websocket_manager_broadcasts_to_multiple_bounded_clients() -> None:
    async def scenario() -> None:
        status = make_status()
        manager = SimulationWebSocketManager(lambda: status, queue_size=2)
        loop = asyncio.get_running_loop()
        first = manager.connect(loop)
        second = manager.connect(loop)

        await first.queue.get()
        await second.queue.get()
        manager.publish(
            make_status(simulation_time=0.05),
            {
                "simulation_time": 0.05,
                "spike_ids": [12, 12, 44],
                "total_spike_count": 3,
            },
        )
        await asyncio.sleep(0)

        first_event = await first.queue.get()
        second_event = await second.queue.get()
        assert first_event == second_event
        assert first_event["type"] == "simulation_update"
        assert first_event["spike_ids"] == [12, 12, 44]
        assert first_event["active_neuron_count"] == 2

        for index in range(10):
            manager.publish(
                make_status(simulation_time=index / 100),
                {"simulation_time": index / 100},
            )
        await asyncio.sleep(0)
        assert first.queue.qsize() <= 2
        assert second.queue.qsize() <= 2

        manager.disconnect(first)
        manager.disconnect(second)

    asyncio.run(scenario())


def test_worker_emits_observations_without_blocking_control_loop() -> None:
    factory_called = Event()
    observations_ready = Event()
    observations: list[dict[str, object]] = []

    class Backend:
        time = 0.0

        def step(self) -> None:
            self.time += 0.01

        def reset(self) -> None:
            self.time = 0.0

        def close(self) -> None:
            pass

        def realtime_state(self) -> dict[str, object]:
            return {
                "simulation_time": self.time,
                "spike_ids": [7],
                "total_spike_count": 1,
            }

    def factory(_visualization: bool) -> Backend:
        factory_called.set()
        return Backend()

    def on_observation(observation: dict[str, object]) -> None:
        observations.append(observation)
        if len(observations) >= 2:
            observations_ready.set()

    def on_error(exc: Exception) -> None:
        raise AssertionError("worker failed") from exc

    worker = SimulationWorker(
        factory,
        on_started=lambda: None,
        on_tick=lambda _time: None,
        on_reset=lambda _resume, _time: None,
        on_stopped=lambda: None,
        on_error=on_error,
        on_observation=on_observation,
        observation_interval=0.02,
    )
    worker.start()

    assert factory_called.wait(timeout=2)
    assert observations_ready.wait(timeout=2)

    worker.stop()
    assert worker._thread is not None
    worker._thread.join(timeout=2)

    assert len(observations) >= 2
    assert observations[0]["spike_ids"] == [7]
