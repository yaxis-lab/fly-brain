from __future__ import annotations

from threading import Event
from types import SimpleNamespace

from api.routes.simulation import start
from api.schemas.simulation import (
    SimulationStartRequest,
    SimulationState,
    SimulationStatus,
)
from api.simulation.worker import SimulationWorker
from simulations.flycns2fly.cns import CNS
from simulations.flycns2fly.fly_brain import FlyBrainSimulation


def test_start_request_defaults_to_headless() -> None:
    assert SimulationStartRequest().visualization is False


def test_start_route_propagates_visualization_flag() -> None:
    calls: list[bool] = []

    class RecordingManager:
        def start(self, *, visualization: bool) -> SimulationStatus:
            calls.append(visualization)
            return SimulationStatus(
                state=SimulationState.STARTING,
                simulation_time=0.0,
                message="Initializing the simulation",
                updated_at="2026-01-01T00:00:00Z",
            )

    start(request=None, manager=RecordingManager())
    start(request=SimulationStartRequest(visualization=True), manager=RecordingManager())

    assert calls == [False, True]


def test_worker_passes_visualization_to_backend_factory() -> None:
    factory_called = Event()
    visualization_values: list[bool] = []

    class Backend:
        time = 0.0

        def step(self) -> None:
            self.time += 0.001

        def reset(self) -> None:
            self.time = 0.0

        def close(self) -> None:
            pass

    def factory(visualization: bool) -> Backend:
        visualization_values.append(visualization)
        factory_called.set()
        return Backend()

    worker = SimulationWorker(
        factory,
        visualization=False,
        on_started=lambda: None,
        on_tick=lambda _: None,
        on_reset=lambda _resume, _time: None,
        on_stopped=lambda: None,
        on_error=lambda exc: raise_error(exc),
    )
    worker.start()

    assert factory_called.wait(timeout=2)
    worker.stop()
    assert worker._thread is not None
    worker._thread.join(timeout=2)
    assert visualization_values == [False]


def raise_error(exc: Exception) -> None:
    raise AssertionError("simulation worker failed") from exc


def test_headless_fly_brain_step_does_not_create_viewer(monkeypatch) -> None:
    class FakeSimulation:
        time = 0.0

        def step(self) -> None:
            self.time += 0.001

    class FakeVision:
        retina = object()

        def update(self):
            return object()

    class FakeVisualSystem:
        DT = 0.001
        retina_biases = object()

        def update(self, _vision_input):
            return SimpleNamespace(cell_type_activity={}, time=0.001)

    class FakeCNS:
        def update_visual_input(self, *, activity, biases) -> None:
            pass

        def run(self, _duration) -> None:
            pass

    brain = FlyBrainSimulation.__new__(FlyBrainSimulation)
    brain.simulation = FakeSimulation()
    brain.vision = FakeVision()
    brain.visual_system = FakeVisualSystem()
    brain.cns = FakeCNS()
    brain.visualization = False
    brain.vision_viewer = None
    brain._visual_dt = FakeVisualSystem.DT
    brain._next_visual_update = 0.0
    brain._printed_visual_stats = True

    viewer_module = "simulations.flycns2fly.viewers.vision"
    monkeypatch.setitem(__import__("sys").modules, viewer_module, None)

    brain.step()

    assert brain.vision_viewer is None


def test_cns_reset_restores_network_snapshot() -> None:
    restored_state: list[str] = []

    class FakeNetwork:
        def restore(self, name: str) -> None:
            restored_state.append(name)

    cns = CNS.__new__(CNS)
    cns.network = FakeNetwork()

    cns.reset()

    assert restored_state == [CNS._INITIAL_STATE]


def test_fly_brain_reset_resets_physics_and_subsystems() -> None:
    calls: list[str] = []

    class FakeSimulation:
        time = 0.0

        def reset(self) -> None:
            calls.append("simulation")

    class FakeVision:
        def reset(self) -> None:
            calls.append("vision")

    class FakeVisualSystem:
        DT = 0.025

        def reset(self) -> None:
            calls.append("visual_system")

    class FakeCNS:
        def reset(self) -> None:
            calls.append("cns")

    brain = FlyBrainSimulation.__new__(FlyBrainSimulation)
    brain.simulation = FakeSimulation()
    brain.vision = FakeVision()
    brain.visual_system = FakeVisualSystem()
    brain.cns = FakeCNS()

    brain.reset()

    assert calls == ["simulation", "vision", "visual_system", "cns"]
    assert brain._next_visual_update == 0.025
