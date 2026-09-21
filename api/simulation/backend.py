from pathlib import Path
import logging

import brian2  # noqa: F401  # Brian2 installs signal handlers during import.


logger = logging.getLogger(__name__)


def build_default_simulation(visualization: bool = False):
    """Build the repository's existing FlyGym/FlyVis/Brian2 simulation."""

    logger.info("Building simulation backend")

    from flygym import Simulation
    from flygym.anatomy import (
        ActuatedDOFPreset,
        AxisOrder,
        ContactBodiesPreset,
        JointPreset,
        Skeleton,
    )
    from flygym.compose import (
        ActuatorType,
        FlatGroundWorld,
        KinematicPosePreset,
        NeuroMechFly,
    )
    from flygym.utils.math import Rotation3D

    from simulations.flycns2fly.cns import CNS
    from simulations.flycns2fly.connectome import Connectome
    from simulations.flycns2fly.fly_brain import FlyBrainSimulation

    root = Path(__file__).resolve().parents[2]
    model_dir = root / "data" / "Drosophila_brain_model"
    logger.info("Loading MaleCNS connectome from %s", model_dir)
    connectome = Connectome(
        completeness_path=model_dir / "Completeness_783.csv",
        connectivity_path=model_dir / "Connectivity_783.parquet",
    )
    logger.info(
        "Connectome loaded: neurons=%s connections=%s",
        f"{connectome.num_neurons:,}",
        f"{connectome.num_connections:,}",
    )
    logger.info("Initializing Brian2 CNS")
    cns = CNS(
        connectome=connectome,
        annotations_path=model_dir / "flywire_annotations.tsv",
    )

    logger.info("Initializing FlyGym model")
    fly = NeuroMechFly(name="fly")
    skeleton = Skeleton(
        joint_preset=JointPreset.ALL_BIOLOGICAL,
        axis_order=AxisOrder.YAW_PITCH_ROLL,
    )
    fly.add_joints(skeleton, KinematicPosePreset.NEUTRAL)
    actuated_dofs = skeleton.get_actuated_dofs_from_preset(
        ActuatedDOFPreset.LEGS_ACTIVE_ONLY,
    )
    fly.add_actuators(
        actuated_dofs,
        ActuatorType.POSITION,
        neutral_input=KinematicPosePreset.NEUTRAL,
        kp=50.0,
        ctrlrange=(-3.14, 3.14),
    )
    fly.add_joint_sites(JointPreset.LEGS_ONLY.to_joint_list())
    fly.add_vision()
    fly.colorize()
    fly.add_tracking_camera(name="trackingcam")

    world = FlatGroundWorld()
    world.add_fly(
        fly,
        (0, 0, 0.8),
        Rotation3D("quat", (1, 0, 0, 0)),
        bodysegs_with_ground_contact=ContactBodiesPreset.LEGS_THORAX_ABDOMEN_HEAD,
        add_ground_contact_sensors=False,
    )

    simulation = FlyBrainSimulation(
        simulation=Simulation(world),
        fly_name=fly.name,
        cns=cns,
        visualization=visualization,
    )
    logger.info("Simulation backend ready")
    return simulation
