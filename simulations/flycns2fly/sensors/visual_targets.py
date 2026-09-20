from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


class VisualTargets:
    def __init__(
        self,
        annotations_path: str | Path,
        connectome,
    ):
        self.annotations_path = Path(annotations_path)
        self.connectome = connectome
        self.annotations = pd.read_csv(
            self.annotations_path,
            sep="\t",
        )
        self._targets = self._build_targets()

    def _build_targets(self) -> dict[str, np.ndarray]:
        annotations = self.annotations.copy()
        annotations["root_id"] = annotations["root_id"].astype(np.int64)

        complete_root_ids = set(self.connectome.neurons.index.astype(np.int64))

        visual = annotations[
            annotations["root_id"].isin(complete_root_ids)
            & (annotations["super_class"] == "sensory")
            & (annotations["cell_class"] == "visual")
            & (annotations["cell_type"].isin(["R1-6", "R7", "R8"]))
        ].copy()

        visual["side"] = visual["side"].astype(str).str.strip().str.lower()

        return {
            "left_r16": self._indices(
                visual,
                "R1-6",
                "left",
            ),
            "right_r16": self._indices(
                visual,
                "R1-6",
                "right",
            ),
            "left_r7": self._indices(
                visual,
                "R7",
                "left",
            ),
            "right_r7": self._indices(
                visual,
                "R7",
                "right",
            ),
            "left_r8": self._indices(
                visual,
                "R8",
                "left",
            ),
            "right_r8": self._indices(
                visual,
                "R8",
                "right",
            ),
        }

    def _indices(
        self,
        visual: pd.DataFrame,
        cell_type: str,
        side: str,
    ) -> np.ndarray:
        rows = visual[(visual["cell_type"] == cell_type) & (visual["side"] == side)]

        return np.asarray(
            [self.connectome.brian_index(int(root_id)) for root_id in rows["root_id"]],
            dtype=np.int32,
        )

    def get(self, name: str) -> np.ndarray:
        return self._targets[name]

    @property
    def targets(self) -> dict[str, np.ndarray]:
        return self._targets
