from flygym import Simulation
from flygym.anatomy import (
    Skeleton,
    JointPreset,
    AxisOrder,
    ActuatedDOFPreset,
    ContactBodiesPreset,
)
from flygym.compose import (
    NeuroMechFly,
    ActuatorType,
    FlatGroundWorld,
    KinematicPosePreset,
)
from flygym.rendering import launch_interactive_viewer
from flygym.utils.math import Rotation3D

from .fly_brain import FlyBrainSimulation


def main() -> None:
    joint_preset = JointPreset.ALL_BIOLOGICAL
    axis_order = AxisOrder.YAW_PITCH_ROLL
    actuated_dofs = ActuatedDOFPreset.LEGS_ACTIVE_ONLY
    actuator_type = ActuatorType.POSITION
    actuator_position_gain = 50.0
    neutral_pose = KinematicPosePreset.NEUTRAL

    fly = NeuroMechFly(name="fly")

    skeleton = Skeleton(
        joint_preset=joint_preset,
        axis_order=axis_order,
    )

    fly.add_joints(
        skeleton,
        neutral_pose,
    )

    actuated_dofs_list = skeleton.get_actuated_dofs_from_preset(actuated_dofs)

    fly.add_actuators(
        actuated_dofs_list,
        actuator_type,
        neutral_input=neutral_pose,
        kp=actuator_position_gain,
        ctrlrange=(-3.14, 3.14),
    )

    fly.add_joint_sites(JointPreset.LEGS_ONLY.to_joint_list())
    fly.add_vision()
    fly.colorize()
    fly.add_tracking_camera(
        name="trackingcam",
    )

    world = FlatGroundWorld()
    world.add_fly(
        fly,
        (0, 0, 0.8),  # type: ignore
        Rotation3D(
            "quat",
            (1, 0, 0, 0),  # type: ignore
        ),
        bodysegs_with_ground_contact=ContactBodiesPreset.LEGS_THORAX_ABDOMEN_HEAD,
        add_ground_contact_sensors=False,
    )

    simulation = Simulation(world)

    brain = FlyBrainSimulation(
        simulation=simulation,
        fly_name=fly.name,
    )

    launch_interactive_viewer(
        brain.simulation.mj_model,
        brain.simulation.mj_data,
        run_async=True,
    )

    try:
        while True:
            brain.step()
    finally:
        brain.close()


if __name__ == "__main__":
    main()
