from flygym import Simulation
from brian2 import second

from .cns import CNS
from .sensors.vision import Vision
from .viewers.vision import VisionViewer
from .visual_system import VisualSystem


class FlyBrainSimulation:
    def __init__(
        self,
        simulation: Simulation,
        fly_name: str,
        cns: CNS,
        device: str = "cpu",
    ) -> None:
        self.simulation = simulation
        self.fly_name = fly_name
        self.cns = cns
        self.vision = Vision(
            simulation=self.simulation,
            fly_name=self.fly_name,
        )
        self.visual_system = VisualSystem(device=device)
        self.vision_viewer: VisionViewer | None = None
        self._visual_dt = self.visual_system.DT
        self._next_visual_update = self._visual_dt

        self._printed_visual_stats = False

    @property
    def time(self) -> float:
        return float(self.simulation.time)

    @property
    def timestep(self) -> float:
        return float(self.simulation.timestep)

    def step(self) -> None:
        self.simulation.step()
        if self.simulation.time < self._next_visual_update:
            return
        vision_input = self.vision.update()
        visual_output = self.visual_system.update(
            vision_input,
        )
        self.cns.update_visual_input(
            activity=visual_output.cell_type_activity,
            biases=self.visual_system.retina_biases,
        )
        self.cns.run(self._visual_dt * second)

        if not self._printed_visual_stats:
            for cell_type in ("R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"):
                activity = visual_output.cell_type_activity[cell_type]
                print(
                    f"{cell_type}: "
                    f"shape={activity.shape} "
                    f"left[min={activity[0].min():.6f}, "
                    f"max={activity[0].max():.6f}, "
                    f"mean={activity[0].mean():.6f}, "
                    f"std={activity[0].std():.6f}] "
                    f"right[min={activity[1].min():.6f}, "
                    f"max={activity[1].max():.6f}, "
                    f"mean={activity[1].mean():.6f}, "
                    f"std={activity[1].std():.6f}]"
                )
            self._printed_visual_stats = True

        if self.vision_viewer is None:
            self.vision_viewer = VisionViewer(
                retina=self.vision.retina,
                cell_type="R1",
            )
        self.vision_viewer.update(
            vision=vision_input,
            visual_system=visual_output,
        )
        self._next_visual_update += self._visual_dt

    def warmup(self, duration: float) -> None:
        self.simulation.warmup(duration)
        # vision_input = self.vision.update()
        # visual_output = self.visual_system.update(
        #    vision_input,
        # )
        # if self.vision_viewer is None:
        #    self.vision_viewer = VisionViewer(
        #        retina=self.vision.retina, eye=0, cell_type="R1"
        #    )
        # self.vision_viewer.update(
        #    vision=vision_input,
        #    visual_system=visual_output,
        # )
        self._next_visual_update = self.simulation.time + self.visual_system.DT

    def reset(self) -> None:
        self.vision.reset()
        self.visual_system.reset()
        self.cns.reset()
        self._next_visual_update = self.visual_system.DT

    def close(self) -> None:
        if self.vision_viewer is not None:
            self.vision_viewer.close()
        self.simulation.close()
