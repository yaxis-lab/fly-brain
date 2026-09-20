from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from brian2 import Hz, PoissonGroup, Synapses


@dataclass(frozen=True)
class CNSVisionConfig:
    base_rate_hz: float = 150.0
    gain_hz: float = 150.0


class CNSVision:
    def __init__(
        self,
        neurons,
        target_indices: dict[str, np.ndarray],
        synaptic_weight,
        synaptic_delay,
        synaptic_rate_factor: float,
        config: CNSVisionConfig | None = None,
    ):
        self.neurons = neurons
        self.config = config or CNSVisionConfig()
        self._create_inputs(
            target_indices=target_indices,
            synaptic_weight=synaptic_weight,
            synaptic_delay=synaptic_delay,
            synaptic_rate_factor=synaptic_rate_factor,
        )

    def _create_inputs(
        self,
        target_indices: dict[str, np.ndarray],
        synaptic_weight,
        synaptic_delay,
        synaptic_rate_factor: float,
    ) -> None:
        self.left_r16 = PoissonGroup(
            6 * 721,
            rates=0 * Hz,
            name="visual_left_r16_input",
        )
        self.right_r16 = PoissonGroup(
            6 * 721,
            rates=0 * Hz,
            name="visual_right_r16_input",
        )
        self.left_r7 = PoissonGroup(
            721,
            rates=0 * Hz,
            name="visual_left_r7_input",
        )
        self.right_r7 = PoissonGroup(
            721,
            rates=0 * Hz,
            name="visual_right_r7_input",
        )
        self.left_r8 = PoissonGroup(
            721,
            rates=0 * Hz,
            name="visual_left_r8_input",
        )
        self.right_r8 = PoissonGroup(
            721,
            rates=0 * Hz,
            name="visual_right_r8_input",
        )
        self.synapses = []

        sources = (
            ("left_r16", self.left_r16),
            ("right_r16", self.right_r16),
            ("left_r7", self.left_r7),
            ("right_r7", self.right_r7),
            ("left_r8", self.left_r8),
            ("right_r8", self.right_r8),
        )

        for name, source in sources:
            targets = target_indices[name]
            synapses = Synapses(
                source,
                self.neurons,
                "w : volt",
                on_pre="v += w",
                delay=synaptic_delay,
                name=f"visual_{name}_synapses",
            )

            n = len(targets)
            if n:
                synapses.connect(
                    i=np.arange(n),
                    j=targets,
                )
                synapses.w = synaptic_weight * synaptic_rate_factor

            self.synapses.append(synapses)

    def _encode_rate(self, activity: np.ndarray, bias: float) -> np.ndarray:
        rate = self.config.base_rate_hz + self.config.gain_hz * (activity - bias)
        return np.maximum(rate, 0.0)

    def update(
        self,
        activity: dict[str, np.ndarray],
        biases: dict[str, float],
    ) -> None:
        left_r16 = np.concatenate(
            [
                self._encode_rate(activity["R1"][0], biases["R1"]),
                self._encode_rate(activity["R2"][0], biases["R2"]),
                self._encode_rate(activity["R3"][0], biases["R3"]),
                self._encode_rate(activity["R4"][0], biases["R4"]),
                self._encode_rate(activity["R5"][0], biases["R5"]),
                self._encode_rate(activity["R6"][0], biases["R6"]),
            ]
        )
        right_r16 = np.concatenate(
            [
                self._encode_rate(activity["R1"][1], biases["R1"]),
                self._encode_rate(activity["R2"][1], biases["R2"]),
                self._encode_rate(activity["R3"][1], biases["R3"]),
                self._encode_rate(activity["R4"][1], biases["R4"]),
                self._encode_rate(activity["R5"][1], biases["R5"]),
                self._encode_rate(activity["R6"][1], biases["R6"]),
            ]
        )
        left_r7 = self._encode_rate(
            activity["R7"][0],
            biases["R7"],
        )
        right_r7 = self._encode_rate(
            activity["R7"][1],
            biases["R7"],
        )
        left_r8 = self._encode_rate(
            activity["R8"][0],
            biases["R8"],
        )
        right_r8 = self._encode_rate(
            activity["R8"][1],
            biases["R8"],
        )

        self.left_r16.rates = left_r16 * Hz
        self.right_r16.rates = right_r16 * Hz
        self.left_r7.rates = left_r7 * Hz
        self.right_r7.rates = right_r7 * Hz
        self.left_r8.rates = left_r8 * Hz
        self.right_r8.rates = right_r8 * Hz
