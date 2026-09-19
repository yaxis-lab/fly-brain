#from collections import Counter, defaultdict

#from flyvis import NetworkView, results_dir

#RETINA = {
#    "R1",
#    "R2",
#    "R3",
#    "R4",
#    "R5",
#    "R6",
#    "R7",
#    "R8",
#}

#LAMINA = {
#    "L1",
#    "L2",
#    "L3",
#    "L4",
#    "L5",
#}


#def decode(value):
#    if isinstance(value, bytes):
#        return value.decode()
#    return str(value)


#def main():
#    model_path = results_dir / "flow" / "0000" / "000"

#    network = NetworkView(model_path)
#    network.init_network(checkpoint="best")

#    edges = network.connectome.edges

#    source_type = [decode(x) for x in edges.source_type[:]]
#    target_type = [decode(x) for x in edges.target_type[:]]
#    n_syn = edges.n_syn[:]

#    print("Total edge records:", len(source_type))

#    # ------------------------------------------------------------
#    # R1-R8 -> L1-L5
#    # ------------------------------------------------------------

#    retina_to_lamina = Counter()
#    retina_to_lamina_synapses = Counter()

#    # ------------------------------------------------------------
#    # L1-L5 -> downstream
#    # ------------------------------------------------------------

#    lamina_to_downstream = Counter()
#    lamina_to_downstream_synapses = Counter()

#    for src, dst, syn in zip(source_type, target_type, n_syn):
#        if src in RETINA and dst in LAMINA:
#            retina_to_lamina[(src, dst)] += 1
#            retina_to_lamina_synapses[(src, dst)] += syn

#        if src in LAMINA:
#            lamina_to_downstream[(src, dst)] += 1
#            lamina_to_downstream_synapses[(src, dst)] += syn

#    print("\n=== RETINA -> LAMINA ===")

#    for src in sorted(RETINA):
#        print(f"\n{src}")

#        for dst in sorted(LAMINA):
#            records = retina_to_lamina[(src, dst)]
#            synapses = retina_to_lamina_synapses[(src, dst)]

#            if records:
#                print(
#                    f"  -> {dst}: " f"{records} edge records, " f"{synapses} synapses"
#                )

#    print("\n=== LAMINA -> DOWNSTREAM ===")

#    for src in sorted(LAMINA):
#        print(f"\n{src}")

#        targets = [dst for (source, dst) in lamina_to_downstream if source == src]

#        for dst in sorted(targets):
#            records = lamina_to_downstream[(src, dst)]
#            synapses = lamina_to_downstream_synapses[(src, dst)]

#            print(f"  -> {dst}: " f"{records} edge records, " f"{synapses} synapses")


#if __name__ == "__main__":
#    main()



from pathlib import Path
import pandas as pd


def main():
    path = Path("data/Drosophila_brain_model/flywire_annotations.tsv")

    df = pd.read_csv(
        path,
        sep="\t",
        low_memory=False,
    )

    flyvis_types = {
        "L1", "L2", "L3", "L4", "L5",
        "Mi1", "Mi2", "Mi3", "Mi4", "Mi9",
        "Mi10", "Mi11", "Mi12", "Mi13", "Mi14", "Mi15",
        "Tm1", "Tm2", "Tm3", "Tm4",
        "Tm9", "Tm16", "Tm20", "Tm28", "Tm30",
        "Tm5a", "Tm5b", "Tm5c", "Tm5Y",
        "TmY3", "TmY4", "TmY5a", "TmY9",
        "TmY10", "TmY13", "TmY14", "TmY15", "TmY18",
        "T4a", "T4b", "T4c", "T4d",
        "T5a", "T5b", "T5c", "T5d",
    }

    present = (
        df[df["cell_type"].isin(flyvis_types)]
        .groupby("cell_type")
        .size()
        .sort_index()
    )

    print("\n=== FLYVIS TYPES PRESENT IN MALECNS ===")
    print(present.to_string())

    print("\n=== TOTAL ===")
    print("Cell types:", len(present))
    print("Neurons:", int(present.sum()))


if __name__ == "__main__":
    main()