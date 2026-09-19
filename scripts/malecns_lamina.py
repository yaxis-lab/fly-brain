from pathlib import Path
import pandas as pd


def main():
    path = Path("data/Drosophila_brain_model/flywire_annotations.tsv")

    df = pd.read_csv(path, sep="\t")

    print("Total annotations:", len(df))

    print("\n=== CELL TYPES CONTAINING L ===")

    cell_types = df["cell_type"].dropna().astype(str).unique()

    for cell_type in sorted(cell_types):
        if cell_type.startswith("L"):
            print(cell_type)

    print("\n=== EXACT L1-L5 ===")

    lamina_types = ["L1", "L2", "L3", "L4", "L5"]

    lamina = df[df["cell_type"].isin(lamina_types)].copy()

    print(lamina.groupby(["cell_type", "side"], dropna=False).size().to_string())

    print("\n=== TOTALS ===")

    print(lamina["cell_type"].value_counts().sort_index().to_string())

    print("\n=== SUPER CLASS ===")

    print(
        lamina.groupby(
            ["cell_type", "super_class"],
            dropna=False,
        )
        .size()
        .to_string()
    )

    print("\n=== CELL CLASS ===")

    print(
        lamina.groupby(
            ["cell_type", "cell_class"],
            dropna=False,
        )
        .size()
        .to_string()
    )


if __name__ == "__main__":
    main()
