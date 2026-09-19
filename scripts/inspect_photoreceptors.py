from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# from sklearn.decomposition import PCA

## ------------------------------------------------------------
## Paths
## ------------------------------------------------------------

ROOT = Path(__file__).resolve().parent

BRAIN_DIR = Path("data/Drosophila_brain_model")

PATH_COMP = BRAIN_DIR / "Completeness_783.csv"
PATH_CONN = BRAIN_DIR / "Connectivity_783.parquet"
PATH_ANN = BRAIN_DIR / "flywire_annotations.tsv"


## ------------------------------------------------------------
## Load completeness
## ------------------------------------------------------------

print("Loading completeness...")

df_comp = pd.read_csv(
    PATH_COMP,
    index_col=0,
)

print(f"  Completeness: {len(df_comp):,} neurons")


# FlyWire root_id -> Brian2 index
flyid2i = {flyid: i for i, flyid in enumerate(df_comp.index)}


## ------------------------------------------------------------
## Load annotations
## ------------------------------------------------------------

print("Loading annotations...")

df_ann = pd.read_csv(
    PATH_ANN,
    sep="\t",
    low_memory=False,
)

df_ann["brian_idx"] = df_ann["root_id"].map(flyid2i)

print(f"  Annotations: {len(df_ann):,} rows")


## ------------------------------------------------------------
## Select MaleCNS photoreceptors
## ------------------------------------------------------------

phot = df_ann[
    (df_ann["super_class"] == "sensory")
    & (df_ann["cell_class"] == "visual")
    & (df_ann["cell_type"].isin(["R1-6", "R7", "R8"]))
    & (df_ann["brian_idx"].notna())
].copy()

phot["brian_idx"] = phot["brian_idx"].astype(int)
phot["side"] = phot["side"].astype(str).str.strip().str.lower()


## ------------------------------------------------------------
## Population counts
## ------------------------------------------------------------

# print("\n" + "=" * 80)
# print("PHOTORECEPTOR COUNTS")
# print("=" * 80)

# print(phot.groupby(["cell_type", "side"]).size().unstack(fill_value=0))


## ------------------------------------------------------------
## Metadata
## ------------------------------------------------------------

# for cell_type in ["R1-6", "R7", "R8"]:

#    subset = phot[phot["cell_type"] == cell_type]

#    print("\n" + "=" * 80)
#    print(f"{cell_type} — METADATA")
#    print("=" * 80)

#    for column in [
#        "supertype",
#        "hemibrain_type",
#        "matching_notes",
#        "synonyms",
#        "nerve",
#        "top_nt",
#    ]:

#        print(f"\n--- {column} ---")

#        print(subset[column].value_counts(dropna=False).head(30))


## ------------------------------------------------------------
## Coordinate statistics
## ------------------------------------------------------------

# for coords in [
#    ["pos_x", "pos_y", "pos_z"],
#    ["soma_x", "soma_y", "soma_z"],
# ]:

#    print("\n" + "=" * 80)
#    print(f"COORDINATES: {coords}")
#    print("=" * 80)

#    for cell_type in ["R1-6", "R7", "R8"]:

#        for side in ["left", "right"]:

#            subset = phot[(phot["cell_type"] == cell_type) & (phot["side"] == side)]

#            print(f"\n{cell_type} / {side}: " f"n={len(subset)}")

#            print(subset[coords].describe().loc[["min", "max", "mean", "std"]])


## ------------------------------------------------------------
## 3D plotting
## ------------------------------------------------------------


# def plot_population(cell_type, side):

#    subset = phot[(phot["cell_type"] == cell_type) & (phot["side"] == side)]

#    fig = plt.figure(figsize=(9, 8))
#    ax = fig.add_subplot(111, projection="3d")

#    ax.scatter(
#        subset["pos_x"],
#        subset["pos_y"],
#        subset["pos_z"],
#        s=3,
#        alpha=0.6,
#    )

#    ax.set_xlabel("pos_x")
#    ax.set_ylabel("pos_y")
#    ax.set_zlabel("pos_z")

#    ax.set_title(f"MaleCNS {cell_type} — {side} — " f"n={len(subset)}")

#    plt.tight_layout()
#    plt.show()


# for cell_type in ["R1-6", "R7", "R8"]:
#    for side in ["left", "right"]:
#        plot_population(cell_type, side)


## ------------------------------------------------------------
## Combined eye plots
## ------------------------------------------------------------


# def plot_eye(side):

#    subset = phot[phot["side"] == side]

#    fig = plt.figure(figsize=(10, 9))
#    ax = fig.add_subplot(111, projection="3d")

#    for cell_type in ["R1-6", "R7", "R8"]:

#        group = subset[subset["cell_type"] == cell_type]

#        ax.scatter(
#            group["pos_x"],
#            group["pos_y"],
#            group["pos_z"],
#            s=3,
#            alpha=0.5,
#            label=cell_type,
#        )

#    ax.set_xlabel("pos_x")
#    ax.set_ylabel("pos_y")
#    ax.set_zlabel("pos_z")

#    ax.set_title(f"MaleCNS photoreceptors — {side} eye")

#    ax.legend()

#    plt.tight_layout()
#    plt.show()


# plot_eye("left")
# plot_eye("right")


# def inspect_spatial_structure(cell_type, side):

#    subset = phot[(phot["cell_type"] == cell_type) & (phot["side"] == side)].copy()

#    xyz = subset[["pos_x", "pos_y", "pos_z"]].to_numpy(dtype=float)

#    # PCA
#    pca = PCA(n_components=3)
#    projected = pca.fit_transform(xyz)

#    print("\n" + "=" * 80)
#    print(f"{cell_type} / {side}")
#    print("=" * 80)

#    print("Explained variance:")
#    print(pca.explained_variance_ratio_)

#    print("Principal axes:")
#    print(pca.components_)

#    # --------------------------------------------------------
#    # 2D PCA projection
#    # --------------------------------------------------------

#    fig, ax = plt.subplots(figsize=(9, 8))

#    ax.scatter(
#        projected[:, 0],
#        projected[:, 1],
#        s=3,
#        alpha=0.5,
#    )

#    ax.set_xlabel("PC1")
#    ax.set_ylabel("PC2")
#    ax.set_title(f"{cell_type} — {side} — PCA projection")

#    ax.set_aspect("equal")

#    plt.tight_layout()
#    plt.show()

#    # --------------------------------------------------------
#    # PC1 vs PC3
#    # --------------------------------------------------------

#    fig, ax = plt.subplots(figsize=(9, 8))

#    ax.scatter(
#        projected[:, 0],
#        projected[:, 2],
#        s=3,
#        alpha=0.5,
#    )

#    ax.set_xlabel("PC1")
#    ax.set_ylabel("PC3")
#    ax.set_title(f"{cell_type} — {side} — PC1 vs PC3")

#    plt.tight_layout()
#    plt.show()


# for cell_type in ["R1-6", "R7", "R8"]:
#    for side in ["left", "right"]:
#        inspect_spatial_structure(
#            cell_type,
#            side,
#        )


# def inspect_all_photoreceptors(side):

#    subset = phot[phot["side"] == side].copy()

#    xyz = subset[["pos_x", "pos_y", "pos_z"]].to_numpy(dtype=float)

#    labels = subset["cell_type"].to_numpy()

#    pca = PCA(n_components=3)
#    projected = pca.fit_transform(xyz)

#    fig, ax = plt.subplots(figsize=(10, 9))

#    for cell_type in ["R1-6", "R7", "R8"]:

#        mask = labels == cell_type

#        ax.scatter(
#            projected[mask, 0],
#            projected[mask, 1],
#            s=3,
#            alpha=0.5,
#            label=cell_type,
#        )

#    ax.set_xlabel("PC1")
#    ax.set_ylabel("PC2")
#    ax.set_title(f"All MaleCNS photoreceptors — {side} eye")

#    ax.set_aspect("equal")
#    ax.legend()

#    plt.tight_layout()
#    plt.show()


# inspect_all_photoreceptors("left")
# inspect_all_photoreceptors("right")


from sklearn.neighbors import NearestNeighbors

# def analyze_r16_neighbors(side):

#    subset = phot[(phot["cell_type"] == "R1-6") & (phot["side"] == side)].copy()

#    xyz = subset[["pos_x", "pos_y", "pos_z"]].to_numpy(dtype=float)

#    nn = NearestNeighbors(n_neighbors=10)

#    nn.fit(xyz)

#    distances, indices = nn.kneighbors(xyz)

#    print("\n" + "=" * 80)
#    print(f"R1-6 nearest-neighbor analysis — {side}")
#    print("=" * 80)

#    for k in range(1, 10):

#        d = distances[:, k]

#        print(
#            f"neighbor {k:2d}: "
#            f"median={np.median(d):8.2f}  "
#            f"mean={np.mean(d):8.2f}  "
#            f"p90={np.percentile(d, 90):8.2f}  "
#            f"p99={np.percentile(d, 99):8.2f}"
#        )

#    return distances, indices


# left_distances, left_indices = analyze_r16_neighbors("left")
# right_distances, right_indices = analyze_r16_neighbors("right")


# def plot_neighbor_distances(distances, side):

#    fig, ax = plt.subplots(figsize=(10, 6))

#    for k in range(1, 7):

#        ax.hist(
#            distances[:, k],
#            bins=100,
#            alpha=0.4,
#            label=f"neighbor {k}",
#        )

#    ax.set_xlabel("3D distance")
#    ax.set_ylabel("count")
#    ax.set_title(f"R1-6 nearest-neighbor distances — {side}")

#    ax.legend()

#    plt.tight_layout()
#    plt.show()


# plot_neighbor_distances(
#    left_distances,
#    "left",
# )

# plot_neighbor_distances(
#    right_distances,
#    "right",
# )


print("\nLoading connectivity...")
df_con = pd.read_parquet(PATH_CONN)

# Map Brian index -> annotation row
ann_by_idx = df_ann.set_index("brian_idx", drop=False)

# All R1-6 Brian indices
r16 = df_ann[(df_ann["cell_type"] == "R1-6") & (df_ann["brian_idx"].notna())].copy()

r16["brian_idx"] = r16["brian_idx"].astype(int)

r16_indices = set(r16["brian_idx"])

# Connections originating from R1-6
r16_con = df_con[df_con["Presynaptic_Index"].isin(r16_indices)].copy()

print(f"R1-6 neurons: {len(r16):,}")
print(f"R1-6 outgoing synaptic records: {len(r16_con):,}")


r16_con["target_cell_type"] = r16_con["Postsynaptic_Index"].map(ann_by_idx["cell_type"])

r16_con["target_cell_class"] = r16_con["Postsynaptic_Index"].map(
    ann_by_idx["cell_class"]
)

print("\nTarget cell types:")
print(r16_con["target_cell_type"].value_counts().head(30))


lamina_targets = r16_con[
    r16_con["target_cell_type"].isin(["L1", "L2", "L3", "L4", "L5"])
]

print("\nR1-6 → lamina:")
print(lamina_targets["target_cell_type"].value_counts())

lamina_types = ["L1", "L2", "L3", "L4", "L5"]

r16_lamina = (
    lamina_targets.groupby(["Presynaptic_Index", "target_cell_type"])["Connectivity"]
    .sum()
    .unstack(fill_value=0)
    .reindex(columns=lamina_types, fill_value=0)
)

r16_lamina = r16_lamina.reset_index()

r16_lamina = r16_lamina.merge(
    r16[
        [
            "brian_idx",
            "root_id",
            "side",
            "pos_x",
            "pos_y",
            "pos_z",
        ]
    ],
    left_on="Presynaptic_Index",
    right_on="brian_idx",
    how="left",
)

print("\nR1-6 → lamina connectivity:")
print(r16_lamina.head(30).to_string(index=False))

print("\nConnectivity summary:")
print(r16_lamina[["L1", "L2", "L3", "L4", "L5"]].describe())
