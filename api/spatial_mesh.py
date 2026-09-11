from __future__ import annotations

from io import BytesIO

import trimesh
from cloudvolume import CloudVolume

MESH_SOURCE = "precomputed://gs://flyem-male-cns/" "rois/fullbrain-roi-v4"


_cv: CloudVolume | None = None


def get_cloudvolume() -> CloudVolume:
    global _cv

    if _cv is None:
        _cv = CloudVolume(
            MESH_SOURCE,
            use_https=True,
            fill_missing=False,
            progress=False,
            secrets={"google": None},
        )

    return _cv


def get_region_mesh(
    region_id: int,
) -> bytes:
    cv = get_cloudvolume()

    mesh = cv.mesh.get(region_id)

    if mesh.vertices.size == 0 or mesh.faces.size == 0:
        raise ValueError(f"Region {region_id} has no mesh")

    geometry = trimesh.Trimesh(
        vertices=mesh.vertices,
        faces=mesh.faces,
        process=False,
        validate=False,
    )

    buffer = BytesIO()

    geometry.export(
        buffer,
        file_type="glb",
    )

    return buffer.getvalue()
