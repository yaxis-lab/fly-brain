from pathlib import Path

import numpy as np
import pandas as pd

# ============================================================
# Paths
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

BRAIN_DIR = ROOT / "data" / "Drosophila_brain_model"

PATH_COMP = BRAIN_DIR / "Completeness_783.csv"
PATH_CONN = BRAIN_DIR / "Connectivity_783.parquet"
PATH_ANN = BRAIN_DIR / "flywire_annotations.tsv"


# ============================================================
# Load completeness
# ============================================================

print("=" * 80)
print("LOADING DATA")
print("=" * 80)

print("\nLoading completeness...")

df_comp = pd.read_csv(
    PATH_COMP,
    index_col=0,
)

print(f"  Completeness: {len(df_comp):,} neurons")

flyid2i = {flyid: i for i, flyid in enumerate(df_comp.index)}


# ============================================================
# Load annotations
# ============================================================

print("\nLoading annotations...")

df_ann = pd.read_csv(
    PATH_ANN,
    sep="\t",
    low_memory=False,
)

df_ann["brian_idx"] = df_ann["root_id"].map(flyid2i)

df_ann["side"] = df_ann["side"].astype(str).str.strip().str.lower()

print(f"  Annotations: {len(df_ann):,} rows")


# ============================================================
# Keep one annotation row per Brian index
# ============================================================

ann = df_ann[df_ann["brian_idx"].notna()].copy()

ann["brian_idx"] = ann["brian_idx"].astype(int)

ann = ann.drop_duplicates(subset=["brian_idx"])

print(f"  Unique annotated Brian indices: " f"{len(ann):,}")


# ============================================================
# Lookup tables
# ============================================================

cell_type_by_idx = ann.set_index("brian_idx")["cell_type"]

side_by_idx = ann.set_index("brian_idx")["side"]


# ============================================================
# Load connectivity
# ============================================================

print("\nLoading connectivity...")

df_con = pd.read_parquet(PATH_CONN)

print(f"  Connectivity records: " f"{len(df_con):,}")


# ============================================================
# Select R1-6
# ============================================================

r16 = ann[ann["cell_type"] == "R1-6"].copy()

r16["brian_idx"] = r16["brian_idx"].astype(int)

print("\n" + "=" * 80)
print("R1-6")
print("=" * 80)

print(f"\nR1-6 neurons: {len(r16):,}")

print("\nR1-6 by side:")

print(r16["side"].value_counts())


# ============================================================
# R1-6 outgoing connections
# ============================================================

r16_indices = set(r16["brian_idx"])

r16_con = df_con[df_con["Presynaptic_Index"].isin(r16_indices)].copy()

print(f"\nR1-6 outgoing synaptic records: " f"{len(r16_con):,}")


# ============================================================
# Annotate targets
# ============================================================

r16_con["target_cell_type"] = r16_con["Postsynaptic_Index"].map(cell_type_by_idx)

r16_con["target_side"] = r16_con["Postsynaptic_Index"].map(side_by_idx)


# ============================================================
# Target cell types
# ============================================================

print("\n" + "=" * 80)
print("R1-6 TARGET CELL TYPES")
print("=" * 80)

print(r16_con["target_cell_type"].value_counts().head(40).to_string())


# ============================================================
# Lamina targets
# ============================================================

lamina_types = [
    "L1",
    "L2",
    "L3",
    "L4",
    "L5",
]

lamina_targets = r16_con[r16_con["target_cell_type"].isin(lamina_types)].copy()

print("\n" + "=" * 80)
print("R1-6 → LAMINA")
print("=" * 80)

print("\nSynaptic records by target type:")

print(
    lamina_targets["target_cell_type"]
    .value_counts()
    .reindex(
        lamina_types,
        fill_value=0,
    )
    .to_string()
)


# ============================================================
# Aggregate connectivity
# ============================================================

lamina_matrix = (
    lamina_targets.groupby(
        [
            "Presynaptic_Index",
            "target_cell_type",
        ]
    )["Connectivity"]
    .sum()
    .unstack(fill_value=0)
    .reindex(
        columns=lamina_types,
        fill_value=0,
    )
)


# ============================================================
# IMPORTANT:
# Reindex against ALL 7,931 R1-6 neurons.
#
# This preserves R1-6 neurons with zero lamina connections.
# ============================================================

lamina_matrix = lamina_matrix.reindex(
    r16["brian_idx"],
    fill_value=0,
)

lamina_matrix.index.name = "brian_idx"

r16_lamina = lamina_matrix.reset_index()


# ============================================================
# Add metadata
# ============================================================

metadata = r16[
    [
        "brian_idx",
        "root_id",
        "side",
        "pos_x",
        "pos_y",
        "pos_z",
    ]
].drop_duplicates(subset=["brian_idx"])

r16_lamina = r16_lamina.merge(
    metadata,
    on="brian_idx",
    how="left",
)


# ============================================================
# Convert connectivity to integers
# ============================================================

r16_lamina[lamina_types] = r16_lamina[lamina_types].fillna(0).astype(int)


# ============================================================
# Number of lamina cell types contacted
# ============================================================

r16_lamina["num_lamina_types"] = r16_lamina[lamina_types].gt(0).sum(axis=1)


# ============================================================
# Print first rows
# ============================================================

print("\n" + "=" * 80)
print("R1-6 → L1/L2/L3/L4/L5")
print("=" * 80)

print(
    r16_lamina[
        [
            "brian_idx",
            "side",
            "L1",
            "L2",
            "L3",
            "L4",
            "L5",
            "num_lamina_types",
        ]
    ]
    .head(50)
    .to_string(index=False)
)


# ============================================================
# Complete connectivity summary
# ============================================================

print("\n" + "=" * 80)
print("CONNECTIVITY SUMMARY — ALL 7,931 R1-6")
print("=" * 80)

summary = r16_lamina[lamina_types].describe()

print(summary.to_string())


# ============================================================
# Explicit median
# ============================================================

print("\nMedian connectivity:")

print(r16_lamina[lamina_types].median().to_string())


# ============================================================
# Number of lamina cell types
# ============================================================

print("\nNumber of lamina cell types contacted:")

print(r16_lamina["num_lamina_types"].value_counts().sort_index().to_string())


# ============================================================
# Left / right
# ============================================================

print("\n" + "=" * 80)
print("LEFT / RIGHT")
print("=" * 80)

for side in ["left", "right"]:

    subset = r16_lamina[r16_lamina["side"] == side]

    print(f"\n{side.upper()} — " f"{len(subset):,} R1-6 neurons")

    print(
        subset[lamina_types]
        .describe()
        .loc[["count", "mean", "50%", "min", "max"]]
        .to_string()
    )

    print("\nMedian:")

    print(subset[lamina_types].median().to_string())


# ============================================================
# Connectivity fingerprints
# ============================================================

print("\n" + "=" * 80)
print("CONNECTIVITY FINGERPRINTS")
print("=" * 80)

fingerprints = r16_lamina[lamina_types].value_counts()

print(f"\nUnique L1-L5 fingerprints: " f"{len(fingerprints):,}")

print("\nMost common fingerprints:")

print(fingerprints.head(30).to_string())


# ============================================================
# Save
# ============================================================

output_path = ROOT / "data" / "r16_lamina_connectivity.csv"

r16_lamina.to_csv(
    output_path,
    index=False,
)

print("\nSaved:")

print(f"  {output_path}")

print("\nDone.")
