from pathlib import Path

import numpy as np
from brian2 import SpikeMonitor, ms

from simulations.flycns2fly.cns import CNS
from simulations.flycns2fly.connectome import Connectome
from simulations.flycns2fly.sensors.vision import VisionInput
from simulations.flycns2fly.visual_system import VisualSystem

ROOT = Path(__file__).resolve().parents[1]

COMPLETENESS_PATH = (
    ROOT / "data" / "Drosophila_brain_model" / "Completeness_783.csv"
)

CONNECTIVITY_PATH = (
    ROOT / "data" / "Drosophila_brain_model" / "Connectivity_783.parquet"
)

ANNOTATIONS_PATH = ROOT / "data" / "Drosophila_brain_model" / "flywire_annotations.tsv"


def main() -> None:
    print("Loading connectome...")

    connectome = Connectome(
        completeness_path=COMPLETENESS_PATH,
        connectivity_path=CONNECTIVITY_PATH,
    )

    print(f"Neurons: {connectome.num_neurons:,}")
    print(f"Connections: {connectome.num_connections:,}")

    print("\nLoading visual system...")

    visual_system = VisualSystem(device="cpu")

    print("FlyVis loaded.")

    print("\nCreating CNS...")

    cns = CNS(
        connectome=connectome,
        annotations_path=ANNOTATIONS_PATH,
    )

    print("CNS created.")

    print("\nVisual target counts:")

    for name, indices in cns.visual_targets.targets.items():
        print(f"{name:12s}: {len(indices):4d}")

    # ---------------------------------------------------------
    # Monitor the six visual Poisson populations.
    # ---------------------------------------------------------

    visual_source_monitors = {
        "left_r16": SpikeMonitor(cns.visual_input.left_r16),
        "right_r16": SpikeMonitor(cns.visual_input.right_r16),
        "left_r7": SpikeMonitor(cns.visual_input.left_r7),
        "right_r7": SpikeMonitor(cns.visual_input.right_r7),
        "left_r8": SpikeMonitor(cns.visual_input.left_r8),
        "right_r8": SpikeMonitor(cns.visual_input.right_r8),
    }

    for monitor in visual_source_monitors.values():
        cns.network.add(monitor)

    # ---------------------------------------------------------
    # Synthetic visual input.
    #
    # Constant luminance lets us test:
    #
    # VisionInput -> FlyVis -> CNSVision -> MaleCNS
    #
    # without involving FlyGym yet.
    # ---------------------------------------------------------

    ommatidia = np.ones(
        (2, 721, 2),
        dtype=np.float32,
    )

    vision_input = VisionInput(
        time=0.0,
        raw=np.zeros(
            (2, 1, 1, 3),
            dtype=np.float32,
        ),
        ommatidia=ommatidia,
    )

    print("\nRunning FlyVis...")

    visual_output = visual_system.update(
        vision_input,
    )

    print("FlyVis activity:")

    for cell_type in (
        "R1",
        "R2",
        "R3",
        "R4",
        "R5",
        "R6",
        "R7",
        "R8",
    ):
        activity = visual_output.cell_type_activity[cell_type]

        print(
            f"{cell_type}: "
            f"left mean={activity[0].mean():.6f}, "
            f"min={activity[0].min():.6f}, "
            f"max={activity[0].max():.6f} | "
            f"right mean={activity[1].mean():.6f}, "
            f"min={activity[1].min():.6f}, "
            f"max={activity[1].max():.6f}"
        )

    # ---------------------------------------------------------
    # Send FlyVis activity into CNS.
    # ---------------------------------------------------------

    cns.update_visual_input(
        activity=visual_output.cell_type_activity,
        biases=visual_system.retina_biases,
    )

    print("\nEncoded visual rates:")

    for name, source in (
        ("left_r16", cns.visual_input.left_r16),
        ("right_r16", cns.visual_input.right_r16),
        ("left_r7", cns.visual_input.left_r7),
        ("right_r7", cns.visual_input.right_r7),
        ("left_r8", cns.visual_input.left_r8),
        ("right_r8", cns.visual_input.right_r8),
    ):
        rates = np.asarray(source.rates / source.rates.unit)

        print(
            f"{name:12s}: "
            f"mean={rates.mean():.3f} Hz, "
            f"min={rates.min():.3f} Hz, "
            f"max={rates.max():.3f} Hz, "
            f"active={np.count_nonzero(rates):,}/{len(rates):,}"
        )

    # ---------------------------------------------------------
    # Run CNS.
    # ---------------------------------------------------------

    duration = 100 * ms

    print(f"\nRunning CNS for {duration}...")

    cns.run(duration)

    # ---------------------------------------------------------
    # Visual source spike counts.
    # ---------------------------------------------------------

    print("\nVisual source spikes:")

    for name, monitor in visual_source_monitors.items():
        print(f"{name:12s}: " f"{monitor.num_spikes:,}")

    # ---------------------------------------------------------
    # CNS spike statistics.
    # ---------------------------------------------------------

    spike_indices = np.asarray(
        cns.spike_monitor.i,
    )

    spike_times = np.asarray(
        cns.spike_monitor.t / ms,
    )

    print("\nCNS spikes:")
    print(f"total spikes: {len(spike_indices):,}")
    print(f"neurons spiking: {len(np.unique(spike_indices)):,}")

    # ---------------------------------------------------------
    # Spikes in the actual visual target populations.
    # ---------------------------------------------------------

    print("\nVisual target spikes:")

    for name, indices in cns.visual_targets.targets.items():
        target_set = set(indices.tolist())

        count = sum(
            1 for neuron_index in spike_indices if int(neuron_index) in target_set
        )

        unique = len(
            {
                int(neuron_index)
                for neuron_index in spike_indices
                if int(neuron_index) in target_set
            }
        )

        print(
            f"{name:12s}: " f"spikes={count:,}, " f"neurons={unique:,}/{len(indices):,}"
        )

    if len(spike_indices) == 0:
        raise RuntimeError("No CNS spikes were produced by the visual input.")

    print("\nVisual CNS test passed: CNS produced spikes.")


if __name__ == "__main__":
    main()
