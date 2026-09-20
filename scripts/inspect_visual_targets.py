from pathlib import Path

from simulations.flycns2fly.connectome import Connectome
from simulations.flycns2fly.sensors.visual_targets import VisualTargets

ROOT = Path(__file__).resolve().parents[1]

completeness_path = ROOT / "data" / "Drosophila_brain_model" / "Completeness_783.csv"

connectivity_path = (
    ROOT / "data" / "Drosophila_brain_model" / "Connectivity_783.parquet"
)

annotations_path = ROOT / "data" / "Drosophila_brain_model" / "flywire_annotations.tsv"


def main():
    connectome = Connectome(
        completeness_path=completeness_path,
        connectivity_path=connectivity_path,
    )

    targets = VisualTargets(
        annotations_path=annotations_path,
        connectome=connectome,
    )

    for name, indices in targets.targets.items():
        print(
            f"{name}: "
            f"count={len(indices)}, "
            f"min={indices.min()}, "
            f"max={indices.max()}"
        )


if __name__ == "__main__":
    main()
