from flygym import Simulation

from .sensors.vision import Vision
from .viewers.vision import VisionViewer
from .visual_system import VisualSystem


class FlyBrainSimulation:
    def __init__(
        self,
        simulation: Simulation,
        fly_name: str,
        device: str = "cpu",
    ) -> None:
        self.simulation = simulation
        self.fly_name = fly_name
        self.vision = Vision(
            simulation=self.simulation,
            fly_name=self.fly_name,
        )
        self.visual_system = VisualSystem(device=device)
        self.vision_viewer: VisionViewer | None = None
        self._next_visual_update = self.visual_system.DT

    @property
    def time(self) -> float:
        return float(self.simulation.time)

    @property
    def timestep(self) -> float:
        return float(self.simulation.timestep)

    def step(self) -> None:
        self.simulation.step()
        vision_input = self.vision.update()
        visual_output = self.visual_system.update(
            vision_input,
        )
        if self.vision_viewer is None:
            self.vision_viewer = VisionViewer(
                retina=self.vision.retina,
                cell_type="R1",
            )
        self.vision_viewer.update(
            vision=vision_input,
            visual_system=visual_output,
        )

    def warmup(self, duration: float) -> None:
        self.simulation.warmup(duration)
        vision_input = self.vision.update()
        visual_output = self.visual_system.update(
            vision_input,
        )
        if self.vision_viewer is None:
            self.vision_viewer = VisionViewer(
                retina=self.vision.retina, eye=0, cell_type="R1"
            )
        self.vision_viewer.update(
            vision=vision_input,
            visual_system=visual_output,
        )
        self._next_visual_update = self.simulation.time + self.visual_system.DT

    def reset(self) -> None:
        self.vision.reset()
        self.visual_system.reset()
        self._next_visual_update = self.visual_system.DT

    def close(self) -> None:
        if self.vision_viewer is not None:
            self.vision_viewer.close()
        self.simulation.close()
