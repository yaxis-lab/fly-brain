from pathlib import Path

import numpy as np
import pandas as pd


class Connectome:
    def __init__(
        self,
        completeness_path: str | Path,
        connectivity_path: str | Path,
    ) -> None:
        self.completeness_path = Path(completeness_path)
        self.connectivity_path = Path(connectivity_path)
        self.neurons = pd.read_csv(
            self.completeness_path,
            index_col=0,
        )
        self.connections = pd.read_parquet(
            self.connectivity_path,
        )
        self._flywire_to_brian = {
            flywire_id: brian_index
            for brian_index, flywire_id in enumerate(self.neurons.index)
        }

    @property
    def num_neurons(self) -> int:
        return len(self.neurons)

    @property
    def num_connections(self) -> int:
        return len(self.connections)

    @property
    def presynaptic_indices(self) -> np.ndarray:
        return self.connections["Presynaptic_Index"].to_numpy()

    @property
    def postsynaptic_indices(self) -> np.ndarray:
        return self.connections["Postsynaptic_Index"].to_numpy()

    @property
    def connectivity(self) -> np.ndarray:
        return self.connections["Excitatory x Connectivity"].to_numpy()

    def brian_index(self, flywire_id: int) -> int:
        return self._flywire_to_brian[flywire_id]
