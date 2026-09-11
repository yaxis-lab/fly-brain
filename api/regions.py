from __future__ import annotations

from typing import Any

# MaleCNS fullbrain-roi-v4 segment IDs.
#
# These come from:
# gs://flyem-male-cns/rois/fullbrain-roi-v4/segment_properties/info
#
# The order is the order used by the official segment-properties metadata.
REGIONS = [
    (1, "AL(L)"),
    (2, "AL(R)"),
    (3, "AME(L)"),
    (4, "AME(R)"),
    (5, "AMMC(L)"),
    (6, "AMMC(R)"),
    (7, "AOTU(L)"),
    (8, "AOTU(R)"),
    (9, "ATL(L)"),
    (10, "ATL(R)"),
    (11, "AVLP(L)"),
    (12, "AVLP(R)"),
    (13, "BU(L)"),
    (14, "BU(R)"),
    (15, "CA(L)"),
    (16, "CA(R)"),
    (17, "CAN(L)"),
    (18, "CAN(R)"),
    (19, "CRE(L)"),
    (20, "CRE(R)"),
    (21, "EB"),
    (22, "EPA(L)"),
    (23, "EPA(R)"),
    (24, "FB"),
    (25, "FLA(L)"),
    (26, "FLA(R)"),
    (27, "GA(L)"),
    (28, "GA(R)"),
    (29, "GNG"),
    (30, "GOR(L)"),
    (31, "GOR(R)"),
    (32, "IB"),
    (33, "ICL(L)"),
    (34, "ICL(R)"),
    (35, "IPS(L)"),
    (36, "IPS(R)"),
    (37, "LA(L)"),
    (38, "LA(R)"),
    (39, "LAL(L)"),
    (40, "LAL(R)"),
    (41, "LH(L)"),
    (42, "LH(R)"),
    (43, "LO(L)"),
    (44, "LO(R)"),
    (45, "LOP(L)"),
    (46, "LOP(R)"),
    (47, "ME(L)"),
    (48, "ME(R)"),
    (49, "NO"),
    (50, "PB"),
    (51, "PED(L)"),
    (52, "PED(R)"),
    (53, "PLP(L)"),
    (54, "PLP(R)"),
    (55, "PRW"),
    (56, "PVLP(L)"),
    (57, "PVLP(R)"),
    (58, "ROB(L)"),
    (59, "ROB(R)"),
    (60, "RUB(L)"),
    (61, "RUB(R)"),
    (62, "SAD"),
    (63, "SCL(L)"),
    (64, "SCL(R)"),
    (65, "SIP(L)"),
    (66, "SIP(R)"),
    (67, "SLP(L)"),
    (68, "SLP(R)"),
    (69, "SMP(L)"),
    (70, "SMP(R)"),
    (71, "SPS(L)"),
    (72, "SPS(R)"),
    (73, "VES(L)"),
    (74, "VES(R)"),
    (75, "WED(L)"),
    (76, "WED(R)"),
    (77, "a'L(L)"),
    (78, "a'L(R)"),
    (79, "aL(L)"),
    (80, "aL(R)"),
    (81, "b'L(L)"),
    (82, "b'L(R)"),
    (83, "bL(L)"),
    (84, "bL(R)"),
    (85, "gL(L)"),
    (86, "gL(R)"),
    (93, "AB(R)"),
    (94, "AB(L)"),
    (95, "CV-anterior"),
    (96, "CRN"),
]


REGION_BY_ID = {region_id: name for region_id, name in REGIONS}


def list_regions() -> list[dict[str, Any]]:
    return [
        {
            "id": region_id,
            "name": name,
        }
        for region_id, name in REGIONS
    ]


def get_region(region_id: int) -> dict[str, Any] | None:
    name = REGION_BY_ID.get(region_id)

    if name is None:
        return None

    return {
        "id": region_id,
        "name": name,
    }
