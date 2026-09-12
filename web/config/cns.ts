import type { CNSMeshSpec } from "@/types/cns";

const FULLBRAIN_BASE_URL =
  "https://storage.googleapis.com/storage/v1/b/flyem-male-cns/o/rois%2Ffullbrain-major-shells";

const VNC_BASE_URL =
  "https://storage.googleapis.com/storage/v1/b/flyem-male-cns/o/rois%2Fvnc-neuropil-shell-v2";

export const CNS_MESHES: readonly CNSMeshSpec[] = [
  {
    id: "central-complex",
    part: "brain",
    segment: "1",
    baseUrl: FULLBRAIN_BASE_URL,
  },
  {
    id: "optic-lobe-left",
    part: "brain",
    segment: "2",
    baseUrl: FULLBRAIN_BASE_URL,
  },
  {
    id: "optic-lobe-right",
    part: "brain",
    segment: "3",
    baseUrl: FULLBRAIN_BASE_URL,
  },
  {
    id: "vnc",
    part: "vnc",
    segment: "1",
    baseUrl: VNC_BASE_URL,
  },
];

export const CNS_CONFIG = {
  meshes: CNS_MESHES,
  coordinateSystem: {
    scale: [1, -1, 1] as const,
  },
  vnc: {
    shiftFraction: 0.12,
  },
  camera: {
    distanceMultiplier: 2.2,
    nearDivisor: 10_000,
    farMultiplier: 20,
  },
} as const;
