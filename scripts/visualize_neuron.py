from pathlib import Path

import navis
import matplotlib.pyplot as plt


SKELETON_DIR = Path(
    "data/malecns/skeletons-swc"
)


def load_neuron(body_id: int):
    """
    Load a MaleCNS neuron skeleton by bodyId.
    """

    path = SKELETON_DIR / f"{body_id}.swc"

    if not path.exists():
        raise FileNotFoundError(
            f"No skeleton found for bodyId={body_id}: {path}"
        )

    neuron = navis.read_swc(
        path,
        include_subgraph=True,
    )

    return neuron


def main():

    body_id = 13882

    print(f"Loading neuron {body_id}...")

    neuron = load_neuron(body_id)

    print("\nNeuron:")
    print(neuron)

    print("\nNumber of nodes:")
    print(len(neuron.nodes))

    print("\nNeuron bounding box:")
    print(neuron.bbox)

    print("\nPlotting...")

    navis.plot3d(
        neuron,
        linewidth=1,
        color="black",
    )
    plt.show()


if __name__ == "__main__":
    main()