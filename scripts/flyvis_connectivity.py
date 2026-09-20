from flyvis import NetworkView, results_dir


def main():
    model_path = results_dir / "flow" / "0000" / "000"

    network = NetworkView(model_path)
    network.init_network(checkpoint="best")

    connectome = network.connectome

    print("\n=== CONNECTOME ATTRIBUTES ===")

    for name in dir(connectome):
        if name.startswith("_"):
            continue

        try:
            value = getattr(connectome, name)
        except Exception:
            continue

        if callable(value):
            continue

        print(f"{name:25s} -> {type(value)}")

    print("\n=== NODE ATTRIBUTES ===")

    nodes = connectome.nodes

    for name in dir(nodes):
        if name.startswith("_"):
            continue

        try:
            value = getattr(nodes, name)
        except Exception:
            continue

        if callable(value):
            continue

        print(f"{name:25s} -> {type(value)}")


if __name__ == "__main__":
    main()
