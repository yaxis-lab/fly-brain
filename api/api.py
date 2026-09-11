import json
import math
from pathlib import Path
from typing import Optional

import duckdb
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from api.spatial import get_spatial_config, LAYERS, layer_to_dict
from api.spatial_mesh import get_region_mesh
from api.regions import get_region, list_regions

# ============================================================
# Paths
# ============================================================

DB_PATH = Path("data/malecns/malecns.duckdb")

SKELETON_DIR = Path("data/malecns/skeletons-swc")


# ============================================================
# FastAPI
# ============================================================

app = FastAPI(
    title="MaleCNS Explorer API",
    version="1.0.0",
    description=(
        "Local API for exploring the MaleCNS v1.0 " "connectome and morphology."
    ),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Database helper
# ============================================================


def query(
    sql: str,
    params: Optional[list] = None,
):

    con = duckdb.connect(
        str(DB_PATH),
        read_only=True,
    )

    try:

        return con.execute(
            sql,
            params or [],
        ).fetchdf()

    finally:

        con.close()


def records_from_df(df, orients="records"):
    if df.empty:
        return []

    return json.loads(
        df.to_json(
            orient=orients,
            date_format="iso",
        )
    )


# ============================================================
# Health
# ============================================================


@app.get("/api/health")
def health():

    return {
        "status": "ok",
        "database": DB_PATH.exists(),
        "morphology": SKELETON_DIR.exists(),
    }


# ============================================================
# Dataset information
# ============================================================


@app.get("/api/dataset/info")
def dataset_info():

    result = query("""
        SELECT
            (SELECT COUNT(*) FROM neurons)
                AS neurons,

            (SELECT COUNT(*) FROM connections)
                AS connections,

            (SELECT COUNT(*) FROM neurotransmitters)
                AS neurotransmitter_rows,

            (SELECT COUNT(*) FROM body_stats)
                AS body_stats_rows,

            (SELECT COUNT(*) FROM morphology)
                AS morphologies
        """)

    row = result.iloc[0]

    return {
        "neurons": int(row["neurons"]),
        "connections": int(row["connections"]),
        "neurotransmitterRows": int(row["neurotransmitter_rows"]),
        "bodyStatsRows": int(row["body_stats_rows"]),
        "morphologies": int(row["morphologies"]),
    }


# ============================================================
# Dataset distributions
# ============================================================


@app.get("/api/dataset/types")
def neuron_types():

    df = query("""
        SELECT
            type,
            COUNT(*) AS count
        FROM neurons
        WHERE type IS NOT NULL
        GROUP BY type
        ORDER BY count DESC
        """)

    return records_from_df(df)


@app.get("/api/dataset/classes")
def neuron_classes():

    df = query("""
        SELECT
            class,
            COUNT(*) AS count
        FROM neurons
        WHERE class IS NOT NULL
        GROUP BY class
        ORDER BY count DESC
        """)

    return records_from_df(df)


@app.get("/api/dataset/superclasses")
def neuron_superclasses():

    df = query("""
        SELECT
            superclass,
            COUNT(*) AS count
        FROM neurons
        WHERE superclass IS NOT NULL
        GROUP BY superclass
        ORDER BY count DESC
        """)

    return records_from_df(df)


@app.get("/api/dataset/neurotransmitters")
def neurotransmitter_distribution():

    df = query("""
        SELECT
            consensus_nt,
            COUNT(*) AS count
        FROM neurotransmitters
        WHERE consensus_nt IS NOT NULL
        GROUP BY consensus_nt
        ORDER BY count DESC
        """)

    return records_from_df(df)


# ============================================================
# Neuron search
# ============================================================


@app.get("/api/neurons/search")
def search_neurons(
    q: str = Query(
        ...,
        min_length=1,
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
    ),
):

    pattern = f"%{q}%"

    df = query(
        """
        SELECT
            bodyId,
            instance,
            type,
            class,
            subclass,
            superclass,
            supertype,
            somaSide,
            rootSide,
            statusLabel
        FROM neurons
        WHERE
            CAST(bodyId AS VARCHAR)
                ILIKE ?

            OR instance ILIKE ?

            OR type ILIKE ?

            OR class ILIKE ?

            OR subclass ILIKE ?

            OR superclass ILIKE ?

            OR supertype ILIKE ?

            OR synonyms ILIKE ?

        LIMIT ?
        """,
        [
            pattern,
            pattern,
            pattern,
            pattern,
            pattern,
            pattern,
            pattern,
            pattern,
            limit,
        ],
    )

    return records_from_df(df)


# ============================================================
# Neuron population query
# ============================================================


@app.get("/api/neurons/query")
def query_neurons(
    type: Optional[str] = None,
    neuron_class: Optional[str] = Query(
        None,
        alias="class",
    ),
    subclass: Optional[str] = None,
    superclass: Optional[str] = None,
    supertype: Optional[str] = None,
    soma_side: Optional[str] = None,
    limit: int = Query(
        1000,
        ge=1,
        le=10000,
    ),
    offset: int = Query(
        0,
        ge=0,
    ),
):

    conditions = []
    params = []

    if type is not None:

        conditions.append("type = ?")

        params.append(type)

    if neuron_class is not None:

        conditions.append("class = ?")

        params.append(neuron_class)

    if subclass is not None:

        conditions.append("subclass = ?")

        params.append(subclass)

    if superclass is not None:

        conditions.append("superclass = ?")

        params.append(superclass)

    if supertype is not None:

        conditions.append("supertype = ?")

        params.append(supertype)

    if soma_side is not None:

        conditions.append("somaSide = ?")

        params.append(soma_side)

    where = ""

    if conditions:

        where = "WHERE " + " AND ".join(conditions)

    params.extend(
        [
            limit,
            offset,
        ]
    )

    df = query(
        f"""
        SELECT
            bodyId,
            instance,
            type,
            class,
            subclass,
            superclass,
            supertype,
            somaSide,
            rootSide,
            statusLabel
        FROM neurons
        {where}
        ORDER BY bodyId
        LIMIT ?
        OFFSET ?
        """,
        params,
    )

    return {
        "count": len(df),
        "offset": offset,
        "limit": limit,
        "neurons": records_from_df(df),
    }


# ============================================================
# Single neuron metadata
# ============================================================


@app.get("/api/neurons/{body_id}")
def get_neuron(
    body_id: int,
):

    neuron = query(
        """
        SELECT *
        FROM neurons
        WHERE bodyId = ?
        """,
        [body_id],
    )

    if neuron.empty:

        raise HTTPException(
            status_code=404,
            detail="Neuron not found",
        )

    result = records_from_df(neuron)[0]

    # --------------------------------------------------------
    # Morphology
    # --------------------------------------------------------

    morphology = query(
        """
        SELECT
            body_id,
            path,
            format
        FROM morphology
        WHERE body_id = ?
        """,
        [body_id],
    )

    if morphology.empty:

        result["hasMorphology"] = False
        result["morphology"] = None

    else:

        result["hasMorphology"] = True
        result["morphology"] = morphology.iloc[0].to_dict()

    # --------------------------------------------------------
    # Neurotransmitter
    # --------------------------------------------------------

    nt = query(
        """
        SELECT *
        FROM neurotransmitters
        WHERE body = ?
        """,
        [body_id],
    )

    result["neurotransmitters"] = records_from_df(nt)

    # --------------------------------------------------------
    # Body statistics
    # --------------------------------------------------------

    stats = query(
        """
        SELECT *
        FROM body_stats
        WHERE body = ?
        """,
        [body_id],
    )

    result["bodyStats"] = records_from_df(stats)

    return result


# ============================================================
# Batch morphology
# ============================================================


@app.get("/api/morphology/batch")
def get_morphology_batch(
    body_ids: str = Query(
        ...,
        description=("Comma-separated body IDs"),
    ),
):

    ids = []

    for value in body_ids.split(","):

        value = value.strip()

        if not value:
            continue

        try:
            ids.append(int(value))

        except ValueError:

            raise HTTPException(
                status_code=400,
                detail=(f"Invalid body ID: {value}"),
            )

    if len(ids) > 1000:

        raise HTTPException(
            status_code=400,
            detail=("Maximum 1000 body IDs per request"),
        )

    results = []

    for body_id in ids:

        path = SKELETON_DIR / f"{body_id}.swc"

        results.append(
            {
                "bodyId": body_id,
                "exists": path.exists(),
                "path": (str(path) if path.exists() else None),
            }
        )

    return results


# ============================================================
# Morphology
# ============================================================


@app.get("/api/morphology/{body_id}")
def get_morphology(
    body_id: int,
):

    path = SKELETON_DIR / f"{body_id}.swc"

    if not path.exists():

        raise HTTPException(
            status_code=404,
            detail=(f"No morphology found " f"for bodyId={body_id}"),
        )

    return {
        "bodyId": body_id,
        "format": "swc",
        "path": str(path),
    }


# ============================================================
# Connectivity around a neuron
# ============================================================


@app.get("/api/connectivity/neuron/{body_id}")
def neuron_connectivity(
    body_id: int,
    direction: str = Query(
        "both",
        pattern="^(upstream|downstream|both)$",
    ),
    limit: int = Query(
        1000,
        ge=1,
        le=10000,
    ),
):

    if direction == "upstream":

        df = query(
            """
            SELECT
                body_pre,
                body_post,
                weight
            FROM connections
            WHERE body_post = ?
            ORDER BY weight DESC
            LIMIT ?
            """,
            [
                body_id,
                limit,
            ],
        )

    elif direction == "downstream":

        df = query(
            """
            SELECT
                body_pre,
                body_post,
                weight
            FROM connections
            WHERE body_pre = ?
            ORDER BY weight DESC
            LIMIT ?
            """,
            [
                body_id,
                limit,
            ],
        )

    else:

        df = query(
            """
            SELECT
                body_pre,
                body_post,
                weight
            FROM connections
            WHERE
                body_pre = ?
                OR body_post = ?
            ORDER BY weight DESC
            LIMIT ?
            """,
            [
                body_id,
                body_id,
                limit,
            ],
        )

    return {
        "bodyId": body_id,
        "direction": direction,
        "count": len(df),
        "connections": records_from_df(df),
    }


# ============================================================
# Population connectivity
# ============================================================


@app.get("/api/connectivity/population")
def population_connectivity(
    source_type: Optional[str] = None,
    target_type: Optional[str] = None,
    min_weight: int = Query(
        1,
        ge=1,
    ),
    limit: int = Query(
        10000,
        ge=1,
        le=100000,
    ),
):

    conditions = []
    params = []

    if source_type is not None:

        conditions.append("n1.type = ?")

        params.append(source_type)

    if target_type is not None:

        conditions.append("n2.type = ?")

        params.append(target_type)

    conditions.append("c.weight >= ?")

    params.append(min_weight)

    where = " AND ".join(conditions)

    params.append(limit)

    df = query(
        f"""
        SELECT
            c.body_pre,
            c.body_post,
            c.weight,
            n1.type AS source_type,
            n2.type AS target_type
        FROM connections c

        JOIN neurons n1
            ON c.body_pre = n1.bodyId

        JOIN neurons n2
            ON c.body_post = n2.bodyId

        WHERE {where}

        ORDER BY c.weight DESC

        LIMIT ?
        """,
        params,
    )

    return {
        "count": len(df),
        "connections": records_from_df(df),
    }


@app.get("/api/spatial/config")
def spatial_config():
    return get_spatial_config()


@app.get("/api/scene/cns")
def cns_scene():
    return {
        "dataset": "male-cns:v1.0",
        "scope": "cns",
        "layers": {key: layer_to_dict(layer) for key, layer in LAYERS.items()},
    }


@app.get("/api/scene/brain")
def brain_scene():
    return {
        "dataset": "male-cns:v1.0",
        "scope": "brain",
        "layers": {
            "brain_neuropil": layer_to_dict(LAYERS["brain_neuropil"]),
            "segmentation": layer_to_dict(LAYERS["segmentation"]),
            "em": layer_to_dict(LAYERS["em"]),
        },
    }


@app.get("/api/scene/vnc")
def vnc_scene():
    return {
        "dataset": "male-cns:v1.0",
        "scope": "vnc",
        "layers": {
            "vnc_neuropil": layer_to_dict(LAYERS["vnc_neuropil"]),
            "segmentation": layer_to_dict(LAYERS["segmentation"]),
            "em": layer_to_dict(LAYERS["em"]),
        },
    }


@app.get("/api/regions/{region_id}/mesh")
def region_mesh(region_id: int):
    try:
        data = get_region_mesh(region_id)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    return Response(
        content=data,
        media_type="model/gltf-binary",
        headers={
            "Cache-Control": "public, max-age=3600",
        },
    )


@app.get("/api/regions")
def regions():
    return list_regions()


@app.get("/api/regions/{region_id}")
def region(region_id: int):
    result = get_region(region_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown region: {region_id}",
        )

    return result
