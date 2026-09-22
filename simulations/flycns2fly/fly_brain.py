from typing import TYPE_CHECKING

from flygym import Simulation
from brian2 import second
import mujoco as mj

from .cns import CNS
from .sensors.vision import Vision
from .visual_system import VisualSystem

if TYPE_CHECKING:
    from .viewers.vision import VisionViewer


class FlyBrainSimulation:
    def __init__(
        self,
        simulation: Simulation,
        fly_name: str,
        cns: CNS,
        device: str = "cpu",
        visualization: bool = False,
    ) -> None:
        self.simulation = simulation
        self.fly_name = fly_name
        self.cns = cns
        self.vision = Vision(
            simulation=self.simulation,
            fly_name=self.fly_name,
        )
        self.visual_system = VisualSystem(device=device)
        self.visualization = visualization
        self.vision_viewer: VisionViewer | None = None
        self._visual_dt = self.visual_system.DT
        self._next_visual_update = self._visual_dt

        self._printed_visual_stats = False
        self._scene_description = self._build_scene_description()
        self._scene_sent = False

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

        if self.visualization:
            if self.vision_viewer is None:
                from .viewers.vision import VisionViewer

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
        self.simulation.reset()
        self.vision.reset()
        self.visual_system.reset()
        self.cns.reset()
        self._next_visual_update = self.simulation.time + self.visual_system.DT

    def realtime_state(self) -> dict[str, object]:
        state: dict[str, object] = {
            "simulation_time": self.time,
            "fly_state": {
                "body_positions": self.simulation.get_body_positions(
                    self.fly_name
                ).tolist(),
                "body_rotations": self.simulation.get_body_rotations(
                    self.fly_name
                ).tolist(),
                "joint_angles": self.simulation.get_joint_angles(
                    self.fly_name
                ).tolist(),
            },
            "spike_ids": self.cns.consume_spike_ids(),
            "total_spike_count": self.cns.total_spike_count,
        }
        if not self._scene_sent:
            state["scene"] = self._scene_description
            self._scene_sent = True
        return state

    def _build_scene_description(self) -> dict[str, object]:
        fly = self.simulation.world.fly_lookup[self.fly_name]
        model = self.simulation.mj_model
        body_segments = []

        for body_segment in fly.get_bodysegs_order():
            name = body_segment.name
            asset_name = f"l{name[1:]}" if name.startswith("r") else name
            body_segments.append(
                {
                    "name": name,
                    "asset": f"{asset_name}.stl",
                    "mirror_y": name.startswith("r"),
                    "material": self._material_for_segment(name),
                }
            )

        ground_id = int(self.simulation._internal_ground_geom_ids[0])
        camera_id = mj.mj_name2id(
            model,
            mj.mjtObj.mjOBJ_CAMERA,
            f"{self.fly_name}/trackingcam",
        )

        return {
            "body_segments": body_segments,
            "root_segment": fly.root_segment.name,
            "ground": {
                "size": model.geom_size[ground_id, :2].tolist(),
                "position": model.geom_pos[ground_id].tolist(),
                "checker_a": [0.3, 0.3, 0.3],
                "checker_b": [0.4, 0.4, 0.4],
                "repeat": 250,
            },
            "camera": {
                "position": model.cam_pos0[camera_id].tolist(),
                "rotation_matrix": model.cam_mat0[camera_id].reshape(3, 3).tolist(),
                "fov": float(model.cam_fovy[camera_id]),
            },
            "lights": [
                {
                    "position": model.light_pos[index].tolist(),
                    "direction": model.light_dir[index].tolist(),
                    "diffuse": model.light_diffuse[index].tolist(),
                    "ambient": model.light_ambient[index].tolist(),
                    "specular": model.light_specular[index].tolist(),
                }
                for index in range(model.nlight)
            ],
        }

    @staticmethod
    def _material_for_segment(name: str) -> str:
        if name.endswith("wing"):
            return "wing"
        if name.endswith("eye"):
            return "eye"
        if name.endswith("arista"):
            return "arista"
        if name.endswith("haltere"):
            return "haltere"
        if name in {"c_head", "c_thorax"}:
            return "headthorax"
        if name in {"c_rostrum", "c_haustellum"} or "pedicel" in name or "funiculus" in name:
            return "antennaproboscis"
        if name == "c_abdomen6":
            return "abdomen6"
        if name.startswith("c_abdomen"):
            return "abdomen12345"
        if name.endswith("coxa"):
            return "coxa"
        if name.endswith("trochanterfemur"):
            return "trochanterfemur"
        if name.endswith("tibia"):
            return "tibia"
        return "tarsus"

    def close(self) -> None:
        if self.vision_viewer is not None:
            self.vision_viewer.close()
        self.simulation.close()
