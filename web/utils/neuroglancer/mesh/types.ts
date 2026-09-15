import type { MeshVertexIndices } from "../draco";

export interface MeshFragment {
  readonly id: number;
  readonly positions: Float32Array;
  readonly indices: MeshVertexIndices;
}

export interface FragmentStreamRequest {
  readonly bodyId: bigint;
  readonly lod: number;
  readonly fragmentCount: number;
}
