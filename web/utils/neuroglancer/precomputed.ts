import { vec3 } from "gl-matrix";
import {
  computeOctreeChildOffsets,
  convertMeshData,
  generateHigherOctreeLevel,
  VertexPositionFormat,
} from "./mesh";
import { decodeDracoPartitioned } from "./draco";
import { convertEndian32, Endianness } from "./endian";
import { murmurHash3_x86_128Hash64Bits_Bigint } from "./hash";
import { segmentation_multires_meshes_info } from "@/config/neuroglancer/segmentation";

const HASH_SEED = 0;

export interface MinishardEntry {
  readonly key: bigint;
  readonly start: bigint;
  readonly end: bigint;
}

export interface MultiscaleManifest {
  readonly chunkShape: vec3;
  readonly chunkGridSpatialOrigin: vec3;
  readonly clipLowerBound: vec3;
  readonly clipUpperBound: vec3;
  readonly lodScales: Float32Array<ArrayBuffer>;
  readonly vertexOffsets: Float32Array<ArrayBuffer>;
  readonly numFragmentsPerLod: Uint32Array<ArrayBuffer>;
  readonly fragmentInfo: Uint32Array<ArrayBuffer>;
  readonly octree: Uint32Array;
  readonly offsets: Float64Array;
  readonly lodStartRows: Uint32Array;
}

export class PrecomputedMeshSource {
  private segmentation_info = segmentation_multires_meshes_info;
  //private readonly meshBaseUrl =
  //  "https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/multi-res-meshes";
  private readonly meshBaseUrl = "/api/male-cns/multi-res-meshes";

  getShardLocation(bodyId: bigint) {
    const key = bodyId >> BigInt(this.segmentation_info.sharding.preshift_bits);
    const hash = murmurHash3_x86_128Hash64Bits_Bigint(HASH_SEED, key);
    const minishardMask =
      (BigInt(1) << BigInt(this.segmentation_info.sharding.minishard_bits)) -
      BigInt(1);
    const shardMask =
      (BigInt(1) << BigInt(this.segmentation_info.sharding.shard_bits)) -
      BigInt(1);
    const minishard = Number(hash & minishardMask);
    const shard = Number(
      (hash >> BigInt(this.segmentation_info.sharding.minishard_bits)) &
        shardMask,
    );

    return {
      shard,
      minishard,
      hash,
    };
  }

  async getMinishardBounds(bodyId: bigint) {
    const { shard, minishard } = this.getShardLocation(bodyId);

    const { minishard_bits } = this.segmentation_info.sharding;
    const shardIndexSize = BigInt(16) << BigInt(minishard_bits);
    const minishardIndexStart = BigInt(minishard) * BigInt(16);

    const shardHex = shard
      .toString(16)
      .padStart(Math.ceil(this.segmentation_info.sharding.shard_bits / 4), "0");

    const shardUrl = `${this.meshBaseUrl}/${shardHex}.shard`;
    const response = await fetch(shardUrl, {
      headers: {
        Range:
          `bytes=${minishardIndexStart}-` +
          `${minishardIndexStart + BigInt(15)}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to read shard index: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== 16) {
      throw new Error(`Expected 16 bytes, received ${buffer.byteLength}`);
    }
    const view = new DataView(buffer);
    const relativeStart = view.getBigUint64(0, true);
    const relativeEnd = view.getBigUint64(8, true);

    return {
      start: relativeStart + shardIndexSize,
      end: relativeEnd + shardIndexSize,
    };
  }

  async getMinishardIndex(bodyId: bigint): Promise<ArrayBuffer> {
    const { shard } = this.getShardLocation(bodyId);
    const { start, end } = await this.getMinishardBounds(bodyId);

    const shardHex = shard
      .toString(16)
      .padStart(Math.ceil(this.segmentation_info.sharding.shard_bits / 4), "0");

    const shardUrl = `${this.meshBaseUrl}/${shardHex}.shard`;
    const response = await fetch(shardUrl, {
      headers: {
        Range: `bytes=${start}-${end - BigInt(1)}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to read minishard index: ${response.status}`);
    }

    return response.arrayBuffer();
  }

  decodeMinishardIndex(buffer: ArrayBuffer): readonly MinishardEntry[] {
    if (buffer.byteLength % 24 !== 0) {
      throw new Error(`Invalid minishard index length: ${buffer.byteLength}`);
    }

    const data = new DataView(buffer);
    const count = buffer.byteLength / 24;

    const keys: bigint[] = [];
    const starts: bigint[] = [];
    const sizes: bigint[] = [];

    for (let i = 0; i < count; i += 1) {
      keys.push(data.getBigUint64(i * 8, true));
      starts.push(data.getBigUint64((count + i) * 8, true));
      sizes.push(data.getBigUint64((count * 2 + i) * 8, true));
    }

    const entries: MinishardEntry[] = [];

    let previousKey = BigInt(0);
    let previousStart =
      BigInt(16) << BigInt(this.segmentation_info.sharding.minishard_bits);

    for (let i = 0; i < count; i += 1) {
      const key = previousKey + keys[i];
      const start = previousStart + starts[i];
      const size = sizes[i];
      const end = start + size;

      entries.push({
        key,
        start,
        end,
      });

      previousKey = key;
      previousStart = end;
    }

    return entries;
  }

  async findManifestEntry(bodyId: bigint): Promise<MinishardEntry> {
    const compressedIndex = await this.getMinishardIndex(bodyId);
    const decompressedIndex = await gunzip(compressedIndex);
    const entries = this.decodeMinishardIndex(decompressedIndex);

    const entry = entries.find((candidate) => candidate.key === bodyId);

    if (entry === undefined) {
      throw new Error(`Body ID ${bodyId} was not found in minishard index`);
    }

    return entry;
  }

  async getManifestRange(
    bodyId: bigint,
  ): Promise<{ readonly start: bigint; readonly end: bigint }> {
    const { start, end } = await this.findManifestEntry(bodyId);

    return {
      start: start,
      end: end,
    };
  }

  async downloadManifest(bodyId: bigint): Promise<ArrayBuffer> {
    // 1. Calculate shard from bodyId.
    // 2. Read the shard index.
    // 3. Locate bodyId inside the minishard.
    // 4. Calculate the manifest byte range.
    // 5. Fetch that range from the shard.
    // 6. Decode the manifest.

    //const { shard } = this.getShardLocation(bodyId);
    //const { start, end } = await this.getManifestRange(bodyId);
    //const { shard_bits } = this.segmentation_info.sharding;

    //const shardHex = shard
    //  .toString(16)
    //  .padStart(Math.ceil(shard_bits / 4), "0");
    //const shardUrl = `${this.meshBaseUrl}/${shardHex}.shard`;

    //const response = await fetch(shardUrl, {
    //  headers: {
    //    Range: `bytes=${start}-${end - BigInt(1)}`,
    //  },
    //});

    //if (!response.ok) {
    //  throw new Error(`Failed to download manifest: ${response.status}`);
    //}

    //return response.arrayBuffer();

    const entry = await this.findManifestEntry(bodyId);
    const { shard } = this.getShardLocation(bodyId);
    const { shard_bits } = this.segmentation_info.sharding;
    const shardHex = shard
      .toString(16)
      .padStart(Math.ceil(shard_bits / 4), "0");

    const shardUrl = `${this.meshBaseUrl}/${shardHex}.shard`;
    const response = await fetch(shardUrl, {
      headers: {
        Range: `bytes=${entry.start}-${entry.end - BigInt(1)}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download manifest: ${response.status}`);
    }

    const compressed = await response.arrayBuffer();
    //const decompressed = Bun.gunzipSync(compressed);
    //const decompressed = await gunzip(compressed.buffer);

    return gunzip(compressed);
  }

  async getFragmentRange(
    bodyId: bigint,
    manifest: MultiscaleManifest,
    lod: number,
    fragmentIndex: number,
  ): Promise<{
    readonly start: bigint;
    readonly end: bigint;
  }> {
    if (lod < 0 || lod >= manifest.lodStartRows.length) {
      throw new Error(`LOD ${lod} does not contain stored mesh fragments`);
    }

    const fragmentCount = manifest.numFragmentsPerLod[lod];

    if (fragmentIndex < 0 || fragmentIndex >= fragmentCount) {
      throw new Error(
        `Fragment ${fragmentIndex} is out of range for LOD ${lod}`,
      );
    }

    const row = manifest.lodStartRows[lod] + fragmentIndex;
    const startOffset = manifest.offsets[row];
    const endOffset = manifest.offsets[row + 1];
    const fullDataSize = manifest.offsets[manifest.offsets.length - 1];
    const manifestEntry = await this.findManifestEntry(bodyId);

    const start =
      manifestEntry.start - BigInt(fullDataSize) + BigInt(startOffset);
    const end = manifestEntry.start - BigInt(fullDataSize) + BigInt(endOffset);

    if (end <= start) {
      throw new Error(`Invalid fragment byte range: ${start}-${end}`);
    }

    return {
      start,
      end,
    };
  }

  async downloadMultiscaleFragment(
    bodyId: bigint,
    manifest: MultiscaleManifest,
    lod: number,
    fragmentIndex: number,
  ): Promise<ArrayBuffer> {
    const { shard } = this.getShardLocation(bodyId);
    const { start, end } = await this.getFragmentRange(
      bodyId,
      manifest,
      lod,
      fragmentIndex,
    );
    const { shard_bits } = this.segmentation_info.sharding;
    const shardHex = shard
      .toString(16)
      .padStart(Math.ceil(shard_bits / 4), "0");

    const shardUrl = `${this.meshBaseUrl}/${shardHex}.shard`;
    const response = await fetch(shardUrl, {
      headers: {
        Range: `bytes=${start}-${end - BigInt(1)}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download fragment: ${response.status}`);
    }

    //return response.arrayBuffer();
    //const compressed = new Uint8Array(await response.arrayBuffer());
    //const decompressed = Bun.gunzipSync(compressed);

    //return decompressed.buffer;
    const buffer = await response.arrayBuffer();
    //const bytes = new Uint8Array(buffer);

    //console.log({
    //  start: start.toString(),
    //  end: end.toString(),
    //  byteLength: bytes.byteLength,
    //  firstBytes: Array.from(bytes.slice(0, 16)),
    //});

    return buffer;
  }

  /**
   * At this point, the next step after this is binary manifest decoding.
   * We will decode the returned ArrayBuffer according to Neuroglancer's
   * multiresolution mesh manifest format and obtain the LODs, fragment positions,
   * and fragment offsets.
   *
   * DONE
   */
  decodeMultiscaleManifestChunk(buffer: ArrayBuffer): MultiscaleManifest {
    if (buffer.byteLength < 28 || buffer.byteLength % 4 !== 0) {
      throw new Error(`Invalid manifest size: ${buffer.byteLength}`);
    }

    const view = new DataView(buffer);
    let offset = 0;
    const chunkShape = vec3.fromValues(
      view.getFloat32(offset, true),
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 8, true),
    );
    offset += 12;
    const gridOrigin = vec3.fromValues(
      view.getFloat32(offset, true),
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 8, true),
    );
    offset += 12;
    const numStoredLods = view.getUint32(offset, true);
    offset += 4;
    if (buffer.byteLength < offset + (4 + 4 + 4 * 3) * numStoredLods) {
      throw new Error(
        `Invalid index file size for ${numStoredLods} lods: ${buffer.byteLength}`,
      );
    }
    const storedLodScales = new Float32Array(buffer, offset, numStoredLods);
    offset += 4 * numStoredLods;
    convertEndian32(storedLodScales, Endianness.LITTLE);
    const vertexOffsets = new Float32Array(buffer, offset, numStoredLods * 3);
    convertEndian32(vertexOffsets, Endianness.LITTLE);
    offset += 12 * numStoredLods;
    const numFragmentsPerLod = new Uint32Array(buffer, offset, numStoredLods);
    offset += 4 * numStoredLods;
    convertEndian32(numFragmentsPerLod, Endianness.LITTLE);
    const totalFragments = numFragmentsPerLod.reduce((a, b) => a + b);
    if (buffer.byteLength !== offset + 16 * totalFragments) {
      throw new Error(
        `Invalid index file size for ${numStoredLods} lods and ` +
          `${totalFragments} total fragments: ${buffer.byteLength}`,
      );
    }
    const fragmentInfo = new Uint32Array(buffer, offset);
    convertEndian32(fragmentInfo, Endianness.LITTLE);

    const clipLowerBound = vec3.fromValues(
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    );
    const clipUpperBound = vec3.fromValues(
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    );
    let numLods = Math.max(1, storedLodScales.length);
    {
      let fragmentBase = 0;
      for (let lodIndex = 0; lodIndex < numStoredLods; ++lodIndex) {
        const numFragments = numFragmentsPerLod[lodIndex];

        for (let i = 0; i < 3; ++i) {
          let upperBoundValue = Number.NEGATIVE_INFINITY;
          let lowerBoundValue = Number.POSITIVE_INFINITY;
          const base = fragmentBase + numFragments * i;
          for (let j = 0; j < numFragments; ++j) {
            const v = fragmentInfo[base + j];
            upperBoundValue = Math.max(upperBoundValue, v);
            lowerBoundValue = Math.min(lowerBoundValue, v);
          }
          if (numFragments !== 0) {
            while (
              upperBoundValue >>> (numLods - lodIndex - 1) !==
              lowerBoundValue >>> (numLods - lodIndex - 1)
            ) {
              ++numLods;
            }
            if (lodIndex === 0) {
              clipLowerBound[i] = Math.min(
                clipLowerBound[i],
                (1 << lodIndex) * lowerBoundValue,
              );
              clipUpperBound[i] = Math.max(
                clipUpperBound[i],
                (1 << lodIndex) * (upperBoundValue + 1),
              );
            }
          }
        }
        fragmentBase += numFragments * 4;
      }
    }

    // Compute upper bound on number of nodes that will be in the octree, so that we can allocate a
    // sufficiently large buffer without having to worry about resizing.
    let maxFragments = 0;
    {
      let prevNumFragments = 0;
      let prevLodIndex = 0;
      for (let lodIndex = 0; lodIndex < numStoredLods; ++lodIndex) {
        const numFragments = numFragmentsPerLod[lodIndex];
        maxFragments += prevNumFragments * (lodIndex - prevLodIndex);
        prevLodIndex = lodIndex;
        prevNumFragments = numFragments;
        maxFragments += numFragments;
      }
      maxFragments += (numLods - 1 - prevLodIndex) * prevNumFragments;
    }

    const octreeTemp = new Uint32Array(5 * maxFragments);
    const offsetsTemp = new Float64Array(maxFragments + 1);
    let octree: Uint32Array;
    let offsets: Float64Array;
    const lodStartRows = new Uint32Array(numLods);
    {
      let priorStart = 0;
      let baseRow = 0;
      let dataOffset = 0;
      let fragmentBase = 0;
      for (let lodIndex = 0; lodIndex < numStoredLods; ++lodIndex) {
        const numFragments = numFragmentsPerLod[lodIndex];
        lodStartRows[lodIndex] = baseRow;
        // Copy in indices
        for (let j = 0; j < numFragments; ++j) {
          for (let i = 0; i < 3; ++i) {
            octreeTemp[5 * (baseRow + j) + i] =
              fragmentInfo[fragmentBase + j + i * numFragments];
          }
          const dataSize = fragmentInfo[fragmentBase + j + 3 * numFragments];
          dataOffset += dataSize;
          offsetsTemp[baseRow + j + 1] = dataOffset;
          if (dataSize === 0) {
            // Mark node as empty.
            octreeTemp[5 * (baseRow + j) + 4] = 0x80000000;
          }
        }

        fragmentBase += 4 * numFragments;

        if (lodIndex !== 0) {
          // Connect with prior level
          computeOctreeChildOffsets(
            octreeTemp,
            priorStart,
            baseRow,
            baseRow + numFragments,
          );
        }

        priorStart = baseRow;
        baseRow += numFragments;
        while (
          lodIndex + 1 < numLods &&
          (lodIndex + 1 >= storedLodScales.length ||
            storedLodScales[lodIndex + 1] === 0)
        ) {
          const curEnd = generateHigherOctreeLevel(
            octreeTemp,
            priorStart,
            baseRow,
          );
          offsetsTemp.fill(dataOffset, baseRow + 1, curEnd + 1);
          priorStart = baseRow;
          baseRow = curEnd;
          ++lodIndex;
        }

        //lodStartRows[lodIndex] = baseRow;
      }
      octree = octreeTemp.slice(0, 5 * baseRow);
      offsets = offsetsTemp.slice(0, baseRow + 1);
    }

    const lodScales = new Float32Array(numLods);
    lodScales.set(storedLodScales, 0);
    for (let i = 0; i < storedLodScales.length; ++i) {
      lodScales[i] *= this.segmentation_info.lod_scale_multiplier;
    }

    return {
      chunkShape,
      chunkGridSpatialOrigin: gridOrigin,
      clipLowerBound: vec3.add(
        clipLowerBound,
        gridOrigin,
        vec3.multiply(clipLowerBound, clipLowerBound, chunkShape),
      ),
      clipUpperBound: vec3.add(
        clipUpperBound,
        gridOrigin,
        vec3.multiply(clipUpperBound, clipUpperBound, chunkShape),
      ),
      octree,
      lodScales,
      vertexOffsets,
      fragmentInfo,
      numFragmentsPerLod,
      offsets,
      lodStartRows,
    };
  }

  getFragmentPosition(
    manifest: MultiscaleManifest,
    lod: number,
    fragmentIndex: number,
  ): vec3 {
    if (lod >= manifest.lodStartRows.length) {
      throw new Error(`LOD ${lod} does not contain stored mesh fragments`);
    }
    if (fragmentIndex >= manifest.numFragmentsPerLod[lod]) {
      throw new Error(
        `Fragment ${fragmentIndex} is out of range for LOD ${lod}`,
      );
    }

    const row = manifest.lodStartRows[lod] + fragmentIndex;
    const offset = row * 5;

    return vec3.fromValues(
      manifest.octree[offset],
      manifest.octree[offset + 1],
      manifest.octree[offset + 2],
    );
  }

  async decodeMultiscaleFragmentChunk(
    buffer: ArrayBuffer,
    lod: number,
    manifest: MultiscaleManifest,
    fragmentIndex: number,
  ) {
    const rawMesh = await decodeDracoPartitioned(
      new Uint8Array(buffer),
      this.segmentation_info.vertex_quantization_bits,
      lod !== 0,
    );
    const meshData = convertMeshData(rawMesh, VertexPositionFormat.uint16);
    const subChunkOffsets = rawMesh.subChunkOffsets;

    const fragmentPosition = this.getFragmentPosition(
      manifest,
      lod,
      fragmentIndex,
    );

    const storedPositions = this.reconstructVertexPositions(
      rawMesh.vertexPositions,
      manifest,
      lod,
      fragmentPosition,
    );

    const positions = this.applyTransform(storedPositions);

    // Next:
    // 1. Find fragment's spatial position. getFragmentPosition()
    // 2. Decode quantized vertex positions.
    // 3. Return mesh data ready for Three.js.

    return {
      meshData,
      subChunkOffsets,
      positions,
    };
  }

  async loadMultiscaleFragment(
    bodyId: bigint,
    lod: number,
    fragmentIndex: number,
    manifest: MultiscaleManifest,
  ) {
    const buffer = await this.downloadMultiscaleFragment(
      bodyId,
      manifest,
      lod,
      fragmentIndex,
    );

    return this.decodeMultiscaleFragmentChunk(
      buffer,
      lod,
      manifest,
      fragmentIndex,
    );
  }

  private reconstructVertexPositions(
    vertexPositions:
      | Float32Array<ArrayBufferLike>
      | Uint32Array<ArrayBufferLike>,
    manifest: MultiscaleManifest,
    lod: number,
    fragmentPosition: vec3,
  ): Float32Array {
    const quantizationMax =
      2 ** this.segmentation_info.vertex_quantization_bits - 1;
    const lodScale = 2 ** lod;
    const vertexOffsetBase = lod * 3;
    const positions = new Float32Array(vertexPositions.length);

    const origin = vec3.fromValues(
      manifest.chunkGridSpatialOrigin[0] +
        manifest.vertexOffsets[vertexOffsetBase],

      manifest.chunkGridSpatialOrigin[1] +
        manifest.vertexOffsets[vertexOffsetBase + 1],

      manifest.chunkGridSpatialOrigin[2] +
        manifest.vertexOffsets[vertexOffsetBase + 2],
    );
    const scaledChunkShape = vec3.fromValues(
      manifest.chunkShape[0] * lodScale,
      manifest.chunkShape[1] * lodScale,
      manifest.chunkShape[2] * lodScale,
    );
    const normalizedVertex = vec3.create();
    const position = vec3.create();

    for (let i = 0; i < vertexPositions.length; i += 3) {
      vec3.set(
        normalizedVertex,
        vertexPositions[i] / quantizationMax,
        vertexPositions[i + 1] / quantizationMax,
        vertexPositions[i + 2] / quantizationMax,
      );

      vec3.add(position, fragmentPosition, normalizedVertex);

      vec3.multiply(position, position, scaledChunkShape);

      vec3.add(position, position, origin);

      positions[i] = position[0];
      positions[i + 1] = position[1];
      positions[i + 2] = position[2];
    }

    return positions;
  }

  private applyTransform(positions: Float32Array): Float32Array {
    const transform = this.segmentation_info.transform;
    const transformed = new Float32Array(positions.length);

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      transformed[i] =
        transform[0] * x + transform[1] * y + transform[2] * z + transform[3];

      transformed[i + 1] =
        transform[4] * x + transform[5] * y + transform[6] * z + transform[7];

      transformed[i + 2] =
        transform[8] * x + transform[9] * y + transform[10] * z + transform[11];
    }

    return transformed;
  }
}

async function gunzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));

  return new Response(stream).arrayBuffer();
}
