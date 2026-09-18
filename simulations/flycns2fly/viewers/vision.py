from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np

from ..sensors.vision import VisionInput
from ..visual_system import VisualSystemOutput


class VisionViewer:
    def __init__(
        self,
        retina,
        cell_type: str,
        eye: int = 0,
    ) -> None:
        self.retina = retina
        self.cell_type = cell_type
        self.eye = eye

        self.figure, self.axes = plt.subplots(
            1,
            2,
            figsize=(10, 5),
        )

        self.images = []

        titles = (
            "Input",
            cell_type,
        )

        for ax, title in zip(self.axes, titles):
            ax.set_title(title)
            ax.set_xticks([])
            ax.set_yticks([])

        self.figure.tight_layout()

        plt.ion()
        self.figure.show()

    def update(
        self,
        vision: VisionInput,
        visual_system: VisualSystemOutput,
    ) -> None:
        input_luminance = np.max(
            vision.ommatidia[self.eye],
            axis=-1,
        )
        input_image = self.retina.hex_pxls_to_human_readable(
            input_luminance,
        )

        self._update(
            index=0,
            image=input_image,
            vmin=0.0,
            vmax=1.0,
        )

        activity = visual_system.cell_type_activity[self.cell_type][self.eye]
        activity_image = self.retina.hex_pxls_to_human_readable(
            activity,
        )

        self._update(
            index=1,
            image=activity_image,
        )

        eye_name = "Left" if self.eye == 0 else "Right"

        self.figure.suptitle(
            f"{eye_name} Eye  •  {self.cell_type}  •  t = {visual_system.time:.3f} s"
        )
        self.figure.canvas.draw_idle()
        self.figure.canvas.flush_events()

    def _update(
        self,
        index: int,
        image: np.ndarray,
        vmin: float | None = None,
        vmax: float | None = None,
    ) -> None:
        if index >= len(self.images):
            plotted = self.axes[index].imshow(
                image,
                interpolation="nearest",
                aspect="equal",
                vmin=vmin,
                vmax=vmax,
            )
            self.images.append(plotted)
            return

        plotted = self.images[index]
        plotted.set_data(image)

        if vmin is not None or vmax is not None:
            plotted.set_clim(
                vmin=vmin,
                vmax=vmax,
            )

    def close(self) -> None:
        plt.close(self.figure)
