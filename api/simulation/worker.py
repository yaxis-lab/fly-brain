from __future__ import annotations

from collections.abc import Callable
import logging
from threading import Event, Lock, Thread
from typing import Protocol


logger = logging.getLogger(__name__)


class SimulationBackend(Protocol):
    @property
    def time(self) -> float: ...

    def step(self) -> None: ...

    def reset(self) -> None: ...

    def close(self) -> None: ...


SimulationFactory = Callable[[bool], SimulationBackend]
StartedCallback = Callable[[], None]
TickCallback = Callable[[float], None]
ResetCallback = Callable[[bool, float], None]
StoppedCallback = Callable[[], None]
ErrorCallback = Callable[[Exception], None]


class SimulationWorker:
    """Runs a simulation backend away from the FastAPI request thread."""

    def __init__(
        self,
        factory: SimulationFactory,
        *,
        on_started: StartedCallback,
        on_tick: TickCallback,
        on_reset: ResetCallback,
        on_stopped: StoppedCallback,
        on_error: ErrorCallback,
        visualization: bool = False,
    ) -> None:
        self._factory = factory
        self._visualization = visualization
        self._on_started = on_started
        self._on_tick = on_tick
        self._on_reset = on_reset
        self._on_stopped = on_stopped
        self._on_error = on_error
        self._stop = Event()
        self._run = Event()
        self._reset = Event()
        self._reset_resume = False
        self._thread: Thread | None = None
        self._backend: SimulationBackend | None = None
        self._lock = Lock()
        self._step_count = 0

    @property
    def is_alive(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self) -> None:
        if self.is_alive:
            raise RuntimeError("Simulation worker is already running")
        logger.info("Starting simulation worker thread")
        self._thread = Thread(target=self._run_loop, name="simulation-worker", daemon=True)
        self._thread.start()

    def pause(self) -> None:
        logger.info("Pausing simulation worker")
        self._run.clear()

    def resume(self) -> None:
        logger.info("Resuming simulation worker")
        self._run.set()

    def reset(self, *, resume: bool) -> None:
        logger.info("Reset requested; resume_after_reset=%s", resume)
        self._reset_resume = resume
        self._reset.set()
        self._run.set()

    def stop(self) -> None:
        logger.info("Stopping simulation worker")
        self._stop.set()
        self._run.set()

    def _run_loop(self) -> None:
        backend: SimulationBackend | None = None
        try:
            logger.info("Simulation backend initialization started")
            backend = self._factory(self._visualization)
            with self._lock:
                self._backend = backend

            if self._stop.is_set():
                return

            self._run.set()
            self._on_started()
            logger.info("Simulation worker is running")

            while not self._stop.is_set():
                if self._reset.is_set():
                    self._reset.clear()
                    resume = self._reset_resume
                    logger.info("Resetting simulation backend")
                    backend.reset()
                    self._on_reset(resume, float(backend.time))
                    if not resume:
                        self._run.clear()
                    continue

                if not self._run.wait(timeout=0.1):
                    continue

                backend.step()
                self._step_count += 1
                self._on_tick(float(backend.time))
                if self._step_count % 1000 == 0:
                    logger.info(
                        "Simulation progress: steps=%s simulation_time=%.6fs",
                        self._step_count,
                        float(backend.time),
                    )
        except Exception as exc:
            logger.exception("Simulation worker failed")
            self._on_error(exc)
        finally:
            logger.info("Closing simulation backend")
            if backend is not None:
                try:
                    backend.close()
                except Exception as exc:
                    logger.exception("Simulation backend close failed")
                    self._on_error(exc)
            with self._lock:
                self._backend = None
            self._on_stopped()
            logger.info("Simulation worker stopped")
