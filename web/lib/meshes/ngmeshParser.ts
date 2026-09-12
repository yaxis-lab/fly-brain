import type { MeshData } from "@/types/cns";

const FLOATS_PER_VERTEX = 3;
const BYTES_PER_FLOAT = 4;
const BYTES_PER_UINT32 = 4;
const VERTEX_COUNT_BYTES = 4;

export function parseNgMesh(buffer: ArrayBuffer, segment: string): MeshData {
  if (buffer.byteLength < VERTEX_COUNT_BYTES) {
    throw new Error(`Mesh segment "${segment}" is empty or truncated`);
  }

  const view = new DataView(buffer);
  const vertexCount = view.getUint32(0, true);
  const vertexBytes = vertexCount * FLOATS_PER_VERTEX * BYTES_PER_FLOAT;
  const vertexStart = VERTEX_COUNT_BYTES;
  const indexStart = vertexStart + vertexBytes;

  if (indexStart > buffer.byteLength) {
    throw new Error(`Invalid vertex data in mesh segment "${segment}"`);
  }

  const indexBytes = buffer.byteLength - indexStart;

  if (indexBytes % BYTES_PER_UINT32 !== 0) {
    throw new Error(`Invalid index data in mesh segment "${segment}"`);
  }

  const vertices = new Float32Array(buffer.slice(vertexStart, indexStart));
  const indices = new Uint32Array(buffer.slice(indexStart));

  return {
    vertices,
    indices,
  };
}
