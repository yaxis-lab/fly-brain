from flyvis import NetworkView, results_dir

model_path = results_dir / "flow" / "0000" / "000"

network = NetworkView(model_path)
network.init_network(checkpoint="best")

nodes = network.connectome.nodes
layer_index = nodes.layer_index

print("\n=== FlyVis cell types ===")
for cell_type, indices in sorted(layer_index.items()):
    print(f"{cell_type:20s} {len(indices):4d}")

print("\n=== Node object ===")
print(type(nodes))

print("\n=== Relevant node attributes ===")
for name in dir(nodes):
    if name.startswith("_"):
        continue

    try:
        value = getattr(nodes, name)
    except Exception:
        continue

    if callable(value):
        continue

    print(name, "->", type(value))
