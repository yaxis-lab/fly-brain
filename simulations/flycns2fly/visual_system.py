from dataclasses import dataclass
from typing import Any, cast

import numpy as np
import torch
from flyvis import NetworkView, results_dir

from .sensors.vision import VisionInput

RETINA_BIASES = {
    "R1": 0.444229,
    "R2": 0.472397,
    "R3": 0.286568,
    "R4": 0.528176,
    "R5": 0.523372,
    "R6": 0.488099,
    "R7": 0.399395,
    "R8": 0.791101,
}

@dataclass(frozen=True)
class VisualSystemOutput:
    time: float
    activity: np.ndarray
    cell_types: tuple[str, ...]
    cell_type_activity: dict[str, np.ndarray]


class VisualSystem:
    DT = 0.025
    N_EYES = 2

    def __init__(
        self,
        device: str = "cpu",
    ) -> None:
        self.device = torch.device(device)

        model_path = results_dir / "flow" / "0000" / "000"
        network_view = NetworkView(model_path)
        self.network = network_view.init_network(
            checkpoint="best",
        )
        self.network = self.network.to(self.device)
        self.network.eval()

        for parameter in self.network.parameters():
            parameter.requires_grad_(False)

        layer_index = self.network.connectome.nodes.layer_index  # type: ignore
        self._cell_types = tuple(
            cell_type.decode() if isinstance(cell_type, bytes) else str(cell_type)
            for cell_type in layer_index.keys()
        )
        self._cell_type_indices = {
            (
                cell_type.decode() if isinstance(cell_type, bytes) else str(cell_type)
            ): layer_index[cell_type][:]
            for cell_type in layer_index.keys()
        }

        self._state: Any = None
        self._initialized = False

    @property
    def retina_biases(self) -> dict[str, float]:
        return RETINA_BIASES

    @property
    def cell_types(self) -> tuple[str, ...]:
        return self._cell_types

    @property
    def state(self) -> Any:
        if self._state is None:
            raise RuntimeError("Visual system state has not been initialized.")

        return self._state

    def initialize(self) -> None:
        self._state = self.network.steady_state(
            t_pre=1.0,
            dt=self.DT,
            batch_size=self.N_EYES,
            value=0.5,
        )
        self._initialized = True

    def update(
        self,
        vision: VisionInput,
    ) -> VisualSystemOutput:
        if not self._initialized:
            self.initialize()

        stimulus = self._prepare_stimulus(vision)

        with torch.no_grad():
            self.network.stimulus.zero(
                n_samples=self.N_EYES,
                n_frames=1,
            )
            self.network.stimulus.add_input(stimulus)
            states = cast(
                list[Any],
                self.network.forward(
                    self.network.stimulus(),
                    self.DT,
                    state=self._state,
                    as_states=True,
                ),
            )
        self._state = states[-1]
        activity = self._state.nodes.activity.detach().cpu().numpy()
        cell_type_activity = {
            cell_type: self.activity(cell_type) for cell_type in self._cell_types
        }
        return VisualSystemOutput(
            time=vision.time,
            activity=activity,
            cell_types=self._cell_types,
            cell_type_activity=cell_type_activity,
        )

    def activity(
        self,
        cell_type: str,
    ) -> np.ndarray:
        if cell_type not in self._cell_type_indices:
            raise KeyError(f"Unknown FlyVis cell type: {cell_type}")

        indices = torch.as_tensor(
            self._cell_type_indices[cell_type],
            device=self.state.nodes.activity.device,
            dtype=torch.long,
        )

        return self.state.nodes.activity[:, indices].detach().cpu().numpy()

    def reset(self) -> None:
        self._state = None
        self._initialized = False

    def _prepare_stimulus(
        self,
        vision: VisionInput,
    ) -> torch.Tensor:
        luminance = np.max(
            vision.ommatidia,
            axis=-1,
        ).astype(np.float32)
        return torch.from_numpy(luminance).to(self.device).unsqueeze(1).unsqueeze(2)
