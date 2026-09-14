import type * as THREE from "three";

export type CNSPart = "brain" | "vnc";

export type BrainRegion =
  | "central-complex"
  | "optic-lobe-left"
  | "optic-lobe-right";

export interface MeshData {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
}

export interface NeuronMeshData {
  readonly bodyId: string;
  readonly lod: number;
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
}

export interface CNSMesh {
  readonly id: string;
  readonly part: CNSPart;
  readonly segment: string;
  readonly geometry: THREE.BufferGeometry;
}

export interface CNSMeshSpec {
  readonly id: string;
  readonly part: CNSPart;
  readonly segment: string;
  readonly baseUrl: string;
}

export interface CNSDataset {
  readonly name: string;
  readonly baseUrl: string;
  readonly meshes: readonly CNSMeshSpec[];
}
