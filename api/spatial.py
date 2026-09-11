from __future__ import annotations

from dataclasses import dataclass
from typing import Any

MALECNS_GS = "gs://flyem-male-cns"


@dataclass(frozen=True)
class SpatialLayer:
    name: str
    layer_type: str
    source: str
    description: str
    visible: bool = True


LAYERS = {
    "em": SpatialLayer(
        name="em-clahe",
        layer_type="image",
        source=f"{MALECNS_GS}/em/em-clahe-jpeg",
        description="CLAHE-normalized MaleCNS EM",
        visible=False,
    ),
    "segmentation": SpatialLayer(
        name="cns-seg",
        layer_type="segmentation",
        source=f"{MALECNS_GS}/v1.0/segmentation",
        description="Proofread MaleCNS neuron segmentation",
        visible=True,
    ),
    "brain_neuropil": SpatialLayer(
        name="brain-neuropil",
        layer_type="segmentation",
        source=f"{MALECNS_GS}/rois/fullbrain-roi-v4",
        description="Brain neuropil compartments",
        visible=True,
    ),
    "vnc_neuropil": SpatialLayer(
        name="vnc-neuropil",
        layer_type="segmentation",
        source=f"{MALECNS_GS}/rois/malecns-vnc-neuropil-roi-v0",
        description="VNC neuropil compartments",
        visible=True,
    ),
    "skeletons": SpatialLayer(
        name="skeletons",
        layer_type="skeleton",
        source=(
            f"{MALECNS_GS}/v1.0/segmentation/"
            "skeletons-malecns/skeletons-precomputed/"
        ),
        description="MaleCNS neuron skeletons",
        visible=False,
    ),
}


def layer_to_dict(layer: SpatialLayer) -> dict[str, Any]:
    return {
        "name": layer.name,
        "type": layer.layer_type,
        "source": layer.source,
        "description": layer.description,
        "visible": layer.visible,
    }


def get_spatial_config() -> dict[str, Any]:
    return {
        "dataset": "male-cns:v1.0",
        "coordinate_space": {
            "name": "Male CNS EM",
            "voxel_size_nm": [8, 8, 8],
        },
        "layers": {key: layer_to_dict(layer) for key, layer in LAYERS.items()},
    }
