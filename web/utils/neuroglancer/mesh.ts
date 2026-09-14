import { vec3 } from "gl-matrix";
import { MeshVertexIndices } from "./draco";
import { EncodedVertexPositions } from "neuroglancer/unstable/mesh/base.js";

function lessMsb(a: number, b: number) {
  return a < b && a < (a ^ b);
}

export function zorder3LessThan(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): boolean {
  let mostSignificant0 = z0;
  let mostSignificant1 = z1;

  if (lessMsb(mostSignificant0 ^ mostSignificant1, y0 ^ y1)) {
    mostSignificant0 = y0;
    mostSignificant1 = y1;
  }

  if (lessMsb(mostSignificant0 ^ mostSignificant1, x0 ^ x1)) {
    mostSignificant0 = x0;
    mostSignificant1 = x1;
  }

  return mostSignificant0 < mostSignificant1;
}

export function computeOctreeChildOffsets(
  octree: Uint32Array,
  childStart: number,
  childEnd: number,
  parentEnd: number,
) {
  let childNode = childStart;
  for (let parentNode = childEnd; parentNode < parentEnd; ++parentNode) {
    const parentX = octree[parentNode * 5];
    const parentY = octree[parentNode * 5 + 1];
    const parentZ = octree[parentNode * 5 + 2];
    while (childNode < childEnd) {
      const childX = octree[childNode * 5] >>> 1;
      const childY = octree[childNode * 5 + 1] >>> 1;
      const childZ = octree[childNode * 5 + 2] >>> 1;
      if (!zorder3LessThan(childX, childY, childZ, parentX, parentY, parentZ)) {
        break;
      }
      ++childNode;
    }
    octree[parentNode * 5 + 3] = childNode;
    while (childNode < childEnd) {
      const childX = octree[childNode * 5] >>> 1;
      const childY = octree[childNode * 5 + 1] >>> 1;
      const childZ = octree[childNode * 5 + 2] >>> 1;
      if (childX !== parentX || childY !== parentY || childZ !== parentZ) {
        break;
      }
      ++childNode;
    }
    octree[parentNode * 5 + 4] += childNode;
  }
}

export function generateHigherOctreeLevel(
  octree: Uint32Array,
  priorStart: number,
  priorEnd: number,
): number {
  let curEnd = priorEnd;
  for (let i = 0; i < 3; ++i) {
    octree[curEnd * 5 + i] = octree[priorStart * 5 + i] >>> 1;
  }
  octree[curEnd * 5 + 3] = priorStart;
  for (let i = priorStart + 1; i < priorEnd; ++i) {
    const x = octree[i * 5] >>> 1;
    const y = octree[i * 5 + 1] >>> 1;
    const z = octree[i * 5 + 2] >>> 1;
    if (
      x !== octree[curEnd * 5] ||
      y !== octree[curEnd * 5 + 1] ||
      z !== octree[curEnd * 5 + 2]
    ) {
      octree[curEnd * 5 + 4] = i;
      ++curEnd;
      octree[curEnd * 5] = x;
      octree[curEnd * 5 + 1] = y;
      octree[curEnd * 5 + 2] = z;
      octree[curEnd * 5 + 3] = i;
    }
  }
  octree[curEnd * 5 + 4] = priorEnd;
  ++curEnd;
  return curEnd;
}

export function computeVertexNormals(
  positions: Float32Array | Uint8Array | Uint16Array | Uint32Array,
  indices: Uint8Array | Uint16Array | Uint32Array,
) {
  const vertexNormals = new Float32Array(positions.length);

  const faceNormal = vec3.create();
  const v1v0 = vec3.create();
  const v2v1 = vec3.create();

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    for (let j = 0; j < 3; ++j) {
      v1v0[j] = positions[i1 + j] - positions[i0 + j];
      v2v1[j] = positions[i2 + j] - positions[i1 + j];
    }
    vec3.cross(faceNormal, v1v0, v2v1);
    vec3.normalize(faceNormal, faceNormal);

    for (let k = 0; k < 3; ++k) {
      const index = indices[i + k];
      const offset = index * 3;
      for (let j = 0; j < 3; ++j) {
        vertexNormals[offset + j] += faceNormal[j];
      }
    }
  }

  const numVertices = vertexNormals.length;
  for (let i = 0; i < numVertices; i += 3) {
    const vec = <vec3>vertexNormals.subarray(i, i + 3);
    vec3.normalize(vec, vec);
  }
  return vertexNormals;
}

function snorm8(x: number) {
  return Math.min(Math.max(-127, x * 127 + 0.5), 127) >>> 0;
}
function signNotZero(x: number) {
  return x < 0 ? -1 : 1;
}

export function encodeNormals32fx3ToOctahedron8x2(
  out: Uint8Array,
  normals: Float32Array,
) {
  const length = normals.length;
  let outIndex = 0;
  for (let i = 0; i < length; i += 3) {
    const x = normals[i];
    const y = normals[i + 1];
    const z = normals[i + 2];

    const invL1Norm = 1 / (Math.abs(x) + Math.abs(y) + Math.abs(z));

    if (z < 0) {
      out[outIndex] = snorm8((1 - Math.abs(y * invL1Norm)) * signNotZero(x));
      out[outIndex + 1] = snorm8(
        (1 - Math.abs(x * invL1Norm)) * signNotZero(y),
      );
    } else {
      out[outIndex] = snorm8(x * invL1Norm);
      out[outIndex + 1] = snorm8(y * invL1Norm);
    }
    outIndex += 2;
  }
}

export interface RawMeshData {
  vertexPositions: Float32Array | Uint32Array;
  indices: MeshVertexIndices;
}

export interface RawPartitionedMeshData extends RawMeshData {
  readonly subChunkOffsets: Uint32Array;
}

export enum VertexPositionFormat {
  float32 = 0,
  uint10 = 1,
  uint16 = 2,
}

export function convertMeshData(
  data: RawPartitionedMeshData,
  vertexPositionFormat: VertexPositionFormat,
) {
  const normals = computeVertexNormals(data.vertexPositions, data.indices);
  const encodedNormals = new Uint8Array((normals.length / 3) * 2);
  encodeNormals32fx3ToOctahedron8x2(encodedNormals, normals);
  let encodedIndices: MeshVertexIndices;
  let strips: boolean = false;

  if (
    data.indices.BYTES_PER_ELEMENT === 4 &&
    data.vertexPositions.length / 3 < 65535
  ) {
    encodedIndices = new Uint16Array(data.indices.length);
    encodedIndices.set(data.indices);
  } else {
    encodedIndices = data.indices;
  }
  strips = false;

  let encodedVertexPositions: EncodedVertexPositions;
  if (vertexPositionFormat === VertexPositionFormat.uint10) {
    const vertexPositions = data.vertexPositions;
    const numVertices = vertexPositions.length / 3;
    encodedVertexPositions = new Uint32Array(numVertices);
    for (
      let inputIndex = 0, outputIndex = 0;
      outputIndex < numVertices;
      inputIndex += 3, ++outputIndex
    ) {
      encodedVertexPositions[outputIndex] =
        (vertexPositions[inputIndex] & 1023) |
        ((vertexPositions[inputIndex + 1] & 1023) << 10) |
        ((vertexPositions[inputIndex + 2] & 1023) << 20);
    }
  } else if (vertexPositionFormat === VertexPositionFormat.uint16) {
    const vertexPositions = data.vertexPositions;
    if (vertexPositions.BYTES_PER_ELEMENT === 2) {
      encodedVertexPositions = vertexPositions;
    } else {
      encodedVertexPositions = new Uint16Array(vertexPositions.length);
      encodedVertexPositions.set(vertexPositions);
    }
  } else {
    encodedVertexPositions = data.vertexPositions as Float32Array;
  }

  return {
    vertexPositions: encodedVertexPositions,
    vertexNormals: encodedNormals,
    indices: encodedIndices,
    strips,
  };
}
