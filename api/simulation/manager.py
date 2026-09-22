from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime, timezone
import logging
from threading import RLock

from api.schemas.simulation import SimulationState, SimulationStatus
from api.simulation.backend import build_default_simulation
from api.simulation.worker import SimulationFactory, SimulationWorker


logger = logging.getLogger(__name__)

SimulationObserver = Callable[[SimulationStatus, Mapping[str, object] | None], None]


class SimulationTransitionError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class SimulationManager:
    def __init__(self, factory: SimulationFactory = build_default_simulation) -> None:
        self._factory = factory
        self._worker: SimulationWorker | None = None
        self._lock = RLock()
        self._state = SimulationState.IDLE
        self._simulation_time = 0.0
        self._message = "Simulation is ready to start"
        self._error: str | None = None
        self._updated_at = self._now()
        self._started_at: datetime | None = None
        self._observers: set[SimulationObserver] = set()

    def add_observer(self, observer: SimulationObserver) -> None:
        with self._lock:
            self._observers.add(observer)

    def status(self) -> SimulationStatus:
        with self._lock:
            return SimulationStatus(
                state=self._state,
                simulation_time=self._simulation_time,
                message=self._message,
                error=self._error,
                updated_at=self._updated_at,
                started_at=self._started_at,
            )

    def start(self, *, visualization: bool = False) -> SimulationStatus:
        with self._lock:
            logger.info(
                "Start requested; current_state=%s visualization=%s",
                self._state.value,
                visualization,
            )
            if self._state in {
                SimulationState.STARTING,
                SimulationState.RUNNING,
                SimulationState.PAUSED,
                SimulationState.RESETTING,
                SimulationState.STOPPING,
            }:
                raise SimulationTransitionError(
                    f"Simulation cannot start while it is {self._state.value}"
                )

            self._set_state(
                SimulationState.STARTING,
                "Initializing the simulation",
                error=None,
                preserve_error=False,
            )
            self._notify_observers()
            worker = self._new_worker(visualization=visualization)
            self._worker = worker
            worker.start()
            return self.status()

    def pause(self) -> SimulationStatus:
        with self._lock:
            logger.info("Pause requested; current_state=%s", self._state.value)
            self._require(SimulationState.RUNNING, "pause")
            assert self._worker is not None
            self._worker.pause()
            self._set_state(SimulationState.PAUSED, "Simulation is paused")
            self._notify_observers()
            return self.status()

    def resume(self) -> SimulationStatus:
        with self._lock:
            logger.info("Resume requested; current_state=%s", self._state.value)
            self._require(SimulationState.PAUSED, "resume")
            assert self._worker is not None
            self._worker.resume()
            self._set_state(SimulationState.RUNNING, "Simulation is running")
            self._notify_observers()
            return self.status()

    def reset(self) -> SimulationStatus:
        with self._lock:
            logger.info("Reset requested; current_state=%s", self._state.value)
            if self._state not in {
                SimulationState.RUNNING,
                SimulationState.PAUSED,
            }:
                raise SimulationTransitionError(
                    f"Simulation cannot reset while it is {self._state.value}"
                )
            assert self._worker is not None
            resume = self._state is SimulationState.RUNNING
            self._set_state(SimulationState.RESETTING, "Resetting the simulation")
            self._notify_observers()
            self._worker.reset(resume=resume)
            return self.status()

    def stop(self) -> SimulationStatus:
        with self._lock:
            logger.info("Stop requested; current_state=%s", self._state.value)
            if self._state in {
                SimulationState.IDLE,
                SimulationState.STOPPED,
            }:
                raise SimulationTransitionError(
                    f"Simulation cannot stop while it is {self._state.value}"
                )
            if self._state is SimulationState.ERROR:
                raise SimulationTransitionError(
                    "Simulation has failed; start it again to create a new worker"
                )
            assert self._worker is not None
            self._set_state(SimulationState.STOPPING, "Stopping the simulation")
            self._notify_observers()
            self._worker.stop()
            return self.status()

    def _new_worker(self, *, visualization: bool) -> SimulationWorker:
        return SimulationWorker(
            self._factory,
            visualization=visualization,
            on_started=self._on_started,
            on_tick=self._on_tick,
            on_reset=self._on_reset,
            on_stopped=self._on_stopped,
            on_error=self._on_error,
            on_observation=self._on_observation,
        )

    def _require(self, expected: SimulationState, action: str) -> None:
        if self._state is not expected:
            raise SimulationTransitionError(
                f"Simulation cannot {action} while it is {self._state.value}"
            )

    def _on_started(self) -> None:
        with self._lock:
            if self._state is SimulationState.STARTING:
                self._started_at = self._now()
                self._set_state(SimulationState.RUNNING, "Simulation is running")
                self._notify_observers()

    def _on_tick(self, simulation_time: float) -> None:
        with self._lock:
            self._simulation_time = max(0.0, simulation_time)
            self._updated_at = self._now()

    def _on_reset(self, resume: bool, simulation_time: float) -> None:
        with self._lock:
            self._simulation_time = max(0.0, simulation_time)
            self._set_state(
                SimulationState.RUNNING if resume else SimulationState.PAUSED,
                "Simulation is running" if resume else "Simulation is paused",
            )
            self._notify_observers()

    def _on_observation(self, observation: Mapping[str, object]) -> None:
        with self._lock:
            raw_time = observation.get("simulation_time", self._simulation_time)
            self._simulation_time = max(0.0, float(raw_time))
            self._updated_at = self._now()
            self._notify_observers(observation)

    def _on_error(self, exc: Exception) -> None:
        with self._lock:
            self._error = str(exc) or exc.__class__.__name__
            logger.error("Simulation entered error state: %s", self._error)
            self._set_state(SimulationState.ERROR, "Simulation failed")
            self._notify_observers()

    def _on_stopped(self) -> None:
        with self._lock:
            if self._state is not SimulationState.ERROR:
                self._set_state(SimulationState.STOPPED, "Simulation is stopped")
            self._worker = None
            self._notify_observers()

    def _notify_observers(
        self,
        observation: Mapping[str, object] | None = None,
    ) -> None:
        status = self.status()
        for observer in tuple(self._observers):
            try:
                observer(status, observation)
            except Exception:
                logger.exception("Simulation observer failed")

    def _set_state(
        self,
        state: SimulationState,
        message: str,
        *,
        error: str | None = None,
        preserve_error: bool = True,
    ) -> None:
        previous_state = self._state
        self._state = state
        self._message = message
        if not preserve_error:
            self._error = error
        self._updated_at = self._now()
        if previous_state is not state:
            logger.info(
                "Simulation state transition: %s -> %s (%s)",
                previous_state.value,
                state.value,
                message,
            )

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)
