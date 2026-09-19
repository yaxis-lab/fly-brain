from flyvis import NetworkView, results_dir


def main():
    model_path = results_dir / "flow" / "0000" / "000"

    network = NetworkView(model_path)
    network.init_network(checkpoint="best")

    nodes = network.connectome.nodes

    for cell_type in ["R1", "L1", "L2", "L3", "Mi1", "T4a", "T5a"]:
        indices = nodes.layer_index[cell_type]

        print(f"\n=== {cell_type} ===")
        print("count:", len(indices))

        print("indices:")
        print(indices[:20])

        print("u:")
        print(nodes.u[indices[:20]])

        print("v:")
        print(nodes.v[indices[:20]])


if __name__ == "__main__":
    main()
