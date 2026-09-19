from flyvis import NetworkView, results_dir


def main():
    model_path = results_dir / "flow" / "0000" / "000"

    network = NetworkView(model_path)
    network.init_network(checkpoint="best")

    edges = network.connectome.edges

    print("\n=== EDGES TYPE ===")
    print(type(edges))

    print("\n=== EDGES ATTRIBUTES ===")

    for name in dir(edges):
        if name.startswith("_"):
            continue

        try:
            value = getattr(edges, name)
        except Exception:
            continue

        if callable(value):
            continue

        print(f"{name:25s} -> {type(value)}")


if __name__ == "__main__":
    main()
