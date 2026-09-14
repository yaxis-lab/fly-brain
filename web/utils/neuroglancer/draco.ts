export type MeshVertexIndices = Uint16Array | Uint32Array;
export interface RawMeshData {
  vertexPositions: Float32Array | Uint32Array;
  indices: MeshVertexIndices;
}
export interface RawPartitionedMeshData extends RawMeshData {
  subChunkOffsets: Uint32Array;
}

let wasmModule: WebAssembly.Instance | undefined;
let decodeResult: RawPartitionedMeshData | Error | undefined = undefined;
let dracoModulePromise: Promise<WebAssembly.Instance> | undefined;
let numPartitions = 0;
const libraryEnv = {
  emscripten_notify_memory_growth: (memoryIndex: number) => {
    memoryIndex;
  },
  neuroglancer_draco_receive_decoded_mesh: (
    numFaces: number,
    numVertices: number,
    indicesPointer: number,
    vertexPositionsPointer: number,
    subchunkOffsetsPointer: number,
  ) => {
    const numIndices = numFaces * 3;
    const memory = wasmModule!.exports.memory as WebAssembly.Memory;
    const indices = new Uint32Array(
      memory.buffer,
      indicesPointer,
      numIndices,
    ).slice();
    const vertexPositions = new Uint32Array(
      memory.buffer,
      vertexPositionsPointer,
      3 * numVertices,
    ).slice();
    const subChunkOffsets = new Uint32Array(
      memory.buffer,
      subchunkOffsetsPointer,
      numPartitions + 1,
    ).slice();
    const mesh: RawPartitionedMeshData = {
      indices,
      vertexPositions,
      subChunkOffsets,
    };
    decodeResult = mesh;
  },
  proc_exit: (code: number) => {
    throw `proc exit: ${code}`;
  },
};

function getDracoModulePromise() {
  if (dracoModulePromise == undefined) {
    dracoModulePromise = (async () => {
      const m = (wasmModule = (
        await WebAssembly.instantiateStreaming(
          fetch(new URL("./neuroglancer_draco.wasm", import.meta.url)),
          {
            env: libraryEnv,
            wasi_snapshot_preview1: libraryEnv,
          },
        )
      ).instance);
      (m.exports._initialize as () => void)();
      return m;
    })();
  }
  return dracoModulePromise;
}

export async function decodeDracoPartitioned(
  buffer: Uint8Array,
  vertexQuantizationBits: number,
  partition: boolean,
): Promise<RawPartitionedMeshData> {
  const m = await getDracoModulePromise();
  const offset = (m.exports.malloc as (size: number) => number)(
    buffer.byteLength,
  );
  const heap = new Uint8Array((m.exports.memory as WebAssembly.Memory).buffer);
  heap.set(buffer, offset);
  numPartitions = partition ? 8 : 1;
  const code = (
    m.exports.neuroglancer_draco_decode as (
      input: number,
      inputSize: number,
      partition: boolean,
      vertexQuantizationBits: number,
      decodeIndices: boolean,
    ) => number
  )(offset, buffer.byteLength, partition, vertexQuantizationBits, true);
  if (code === 0) {
    const r = decodeResult;
    decodeResult = undefined;
    if (r instanceof Error) throw r;
    return r!;
  }
  throw new Error(`Failed to decode draco mesh: ${code}`);
}
