from pathlib import Path

import numpy as np
from brian2 import SpikeMonitor

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
from flygym.rendering import launch_interactive_viewer
from flygym.utils.math import Rotation3D

from simulations.flycns2fly.cns import CNS
from simulations.flycns2fly.connectome import Connectome
from simulations.flycns2fly.fly_brain import FlyBrainSimulation

ROOT = Path(__file__).resolve().parents[1]

COMPLETENESS_PATH = ROOT / "data" / "Drosophila_brain_model" / "Completeness_783.csv"

CONNECTIVITY_PATH = (
    ROOT / "data" / "Drosophila_brain_model" / "Connectivity_783.parquet"
)

ANNOTATIONS_PATH = ROOT / "data" / "Drosophila_brain_model" / "flywire_annotations.tsv"


def create_fly() -> NeuroMechFly:
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

    fly.add_tracking_camera(name="trackingcam")

    return fly


def create_simulation() -> tuple[Simulation, str]:
    fly = create_fly()

    world = FlatGroundWorld()

    world.add_fly(
        fly,
        (0, 0, 0.8),
        Rotation3D(
            "quat",
            (1, 0, 0, 0),
        ),
        bodysegs_with_ground_contact=(ContactBodiesPreset.LEGS_THORAX_ABDOMEN_HEAD),
        add_ground_contact_sensors=False,
    )

    simulation = Simulation(world)

    return simulation, fly.name


def main() -> None:
    print("Loading connectome...")

    connectome = Connectome(
        completeness_path=COMPLETENESS_PATH,
        connectivity_path=CONNECTIVITY_PATH,
    )

    print(f"Neurons: {connectome.num_neurons:,}")

    print(f"Connections: {connectome.num_connections:,}")

    print("\nCreating FlyGym simulation...")

    simulation, fly_name = create_simulation()

    print(f"Fly created: {fly_name}")

    print("\nCreating CNS...")

    cns = CNS(
        connectome=connectome,
        annotations_path=ANNOTATIONS_PATH,
    )

    print("CNS created.")

    print("\nCreating FlyBrainSimulation...")

    brain = FlyBrainSimulation(
        simulation=simulation,
        fly_name=fly_name,
        cns=cns,
    )

    print("FlyBrainSimulation created.")

    # ---------------------------------------------------------
    # CNS spike monitor
    # ---------------------------------------------------------

    spike_monitor = SpikeMonitor(
        cns.neurons,
        name="full_flow_cns_monitor",
    )

    cns.network.add(spike_monitor)

    # ---------------------------------------------------------
    # Visual target populations
    # ---------------------------------------------------------

    print("\nVisual target counts:")

    for name, indices in cns.visual_targets.targets.items():
        print(f"{name:12s}: {len(indices):4d}")

    # ---------------------------------------------------------
    # Viewer
    # ---------------------------------------------------------

    launch_interactive_viewer(
        simulation.mj_model,
        simulation.mj_data,
        run_async=True,
    )

    # ---------------------------------------------------------
    # Full-flow test
    # ---------------------------------------------------------

    visual_dt = brain.visual_system.DT
    flygym_dt = brain.simulation.timestep

    steps_per_visual_update = int(round(visual_dt / flygym_dt))

    num_visual_updates = 10

    num_steps = steps_per_visual_update * num_visual_updates

    print(f"FlyGym timestep: {flygym_dt:.6f}s")

    print(f"Visual timestep: {visual_dt:.6f}s")

    print(f"FlyGym steps per visual update: " f"{steps_per_visual_update}")

    print(f"Visual updates: {num_visual_updates}")

    print(f"Total FlyGym steps: {num_steps}")

    print()
    print("========================================")
    print("FULL VISUAL FLOW TEST")
    print("========================================")
    print()
    print("FlyGym" " -> Vision" " -> FlyVis" " -> CNSVision" " -> MaleCNS")
    print()
    print(f"FlyGym steps: {num_steps}")
    print()

    previous_spikes = 0

    try:
        for step in range(num_steps):
            brain.step()

            current_spikes = spike_monitor.num_spikes

            new_spikes = current_spikes - previous_spikes

            if step % 10 == 0 or new_spikes > 0:
                print(
                    f"step={step + 1:03d}/{num_steps:03d} "
                    f"sim_time={brain.time:.4f}s "
                    f"CNS_spikes=+{new_spikes:,} "
                    f"total={current_spikes:,}"
                )

            previous_spikes = current_spikes

    finally:
        final_simulation_time = brain.time
        brain.close()

    # ---------------------------------------------------------
    # Final statistics
    # ---------------------------------------------------------

    spike_indices = np.asarray(spike_monitor.i)

    print()
    print("========================================")
    print("FULL FLOW RESULTS")
    print("========================================")

    print(f"FlyGym simulation time: " f"{final_simulation_time:.4f}s")

    print(f"Total CNS spikes: " f"{len(spike_indices):,}")

    unique_cns_neurons = len(np.unique(spike_indices)) if len(spike_indices) else 0

    print(f"Unique CNS neurons spiking: " f"{unique_cns_neurons:,}")

    # ---------------------------------------------------------
    # Visual target spike statistics
    # ---------------------------------------------------------

    print()
    print("Visual target spikes:")

    for name, indices in cns.visual_targets.targets.items():
        target_set = set(indices.tolist())

        target_spikes = [
            int(neuron_index)
            for neuron_index in spike_indices
            if int(neuron_index) in target_set
        ]

        unique_target_neurons = len(set(target_spikes))

        print(
            f"{name:12s}: "
            f"spikes={len(target_spikes):,}, "
            f"neurons="
            f"{unique_target_neurons:,}/"
            f"{len(indices):,}"
        )

    # ---------------------------------------------------------
    # Result
    # ---------------------------------------------------------

    if len(spike_indices) == 0:
        raise RuntimeError(
            "The full FlyGym -> FlyVis -> CNS " "pipeline produced no CNS spikes."
        )

    print()
    print("Full visual flow test passed.")


if __name__ == "__main__":
    main()
