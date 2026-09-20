from dataclasses import dataclass

import numpy as np
from flygym import Simulation


@dataclass(frozen=True)
class VisionInput:
    time: float
    raw: np.ndarray
    ommatidia: np.ndarray


class Vision:
    def __init__(
        self,
        simulation: Simulation,
        fly_name: str,
    ) -> None:
        self.simulation = simulation
        self.fly_name = fly_name
        self._input: VisionInput | None = None

    @property
    def current(self) -> VisionInput:
        if self._input is None:
            raise RuntimeError("Vision input has not been initialized.")
        return self._input

    @property
    def raw(self) -> np.ndarray:
        return self.current.raw

    @property
    def ommatidia(self) -> np.ndarray:
        return self.current.ommatidia

    @property
    def time(self) -> float:
        return self.current.time

    @property
    def retina(self):
        if self.simulation.retina is None:
            raise RuntimeError("FlyGym retina has not been initialized.")
        return self.simulation.retina

    def update(self) -> VisionInput:
        raw = np.asarray(
            self.simulation.get_raw_vision(self.fly_name),
            dtype=np.float32,
        )
        ommatidia = np.asarray(
            self.simulation.get_ommatidia_readouts(self.fly_name),
            dtype=np.float32,
        )

        self._input = VisionInput(
            time=float(self.simulation.time),
            raw=raw,
            ommatidia=ommatidia,
        )

        return self._input

    def reset(self) -> None:
        self._input = None
