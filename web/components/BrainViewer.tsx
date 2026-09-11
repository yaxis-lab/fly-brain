import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/* ============================================================
   Types
   ============================================================ */

type BrainViewerProps = {
  infoUrl: string;
  background?: "dark" | "transparent" | "white";
  opacity?: number;
  color?: THREE.ColorRepresentation;
  autoFit?: boolean;
};

type LegacyMeshInfo = {
  "@type": "neuroglancer_legacy_mesh";
};

type MultiscaleVolumeInfo = {
  "@type": "neuroglancer_multiscale_volume";
  data_type?: string;
  num_channels?: number;
  type?: string;
  mesh?: string;
  scales?: Array<{
    key: string;
    resolution?: number[];
    size?: number[];
    voxel_offset?: number[];
  }>;
  segment_properties?: string;
};

type SegmentProperties = {
  "@type": "neuroglancer_segment_properties";
  inline?: {
    ids: string[];
    properties: Array<{
      id: string;
      type: string;
      values: string[];
    }>;
  };
};

type AnnotationProperty = {
  id: string;
  type:
    | "uint8"
    | "int8"
    | "uint16"
    | "int16"
    | "uint32"
    | "int32"
    | "float32"
    | "rgb"
    | "rgba";
  enum_values?: number[];
  enum_labels?: string[];
};

type AnnotationSharding = {
  "@type": "neuroglancer_uint64_sharded_v1";
  hash: "identity" | "murmurhash3_x86_128";
  preshift_bits: number;
  minishard_bits: number;
  shard_bits: number;
  minishard_index_encoding: "raw" | "gzip";
  data_encoding: "raw" | "gzip";
};

type AnnotationInfo = {
  "@type": "neuroglancer_annotations_v1";

  dimensions: Record<string, [number, string]>;

  lower_bound: number[];
  upper_bound: number[];

  annotation_type: string;

  properties?: AnnotationProperty[];

  by_id?: {
    key: string;
    sharding?: AnnotationSharding;
  };

  spatial?: Array<{
    key: string;
    sharding?: AnnotationSharding;
    chunk_size: number[];
    grid_shape: number[];
    limit: number;
  }>;

  relationships?: Array<{
    key: string;
    id: string;
    sharding?: AnnotationSharding;
  }>;
};

type DatasetInfo = LegacyMeshInfo | MultiscaleVolumeInfo | AnnotationInfo;

type PointAnnotation = {
  id: bigint;
  position: [number, number, number];
  properties: Record<string, number | number[]>;
};

/* ============================================================
   URL helpers
   ============================================================ */

function getDatasetBaseURL(infoURL: string): string {
  const url = new URL(infoURL);

  const pathname = url.pathname;

  if (pathname.endsWith("%2Finfo")) {
    url.pathname = pathname.slice(0, pathname.length - "%2Finfo".length);
  } else if (pathname.endsWith("/info")) {
    url.pathname = pathname.slice(0, pathname.length - "/info".length);
  } else {
    throw new Error(
      `Expected info URL ending in %2Finfo or /info:\n${infoURL}`,
    );
  }

  url.search = "";

  return url.toString();
}

function appendObjectPath(baseURL: string, childPath: string): string {
  const cleanBase = baseURL.replace(/\/+$/, "");

  const cleanChild = childPath.replace(/^\/+/, "");

  return cleanBase + "%2F" + encodeURIComponent(cleanChild) + "?alt=media";
}

/* ============================================================
   Fetch JSON
   ============================================================ */

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching:\n${url}`);
  }

  return response.json() as Promise<T>;
}

/* ============================================================
   Fetch binary
   ============================================================ */

async function fetchArrayBuffer(
  url: string,
  start?: number,
  end?: number,
): Promise<ArrayBuffer> {
  const headers: HeadersInit = {};

  if (start !== undefined && end !== undefined) {
    headers.Range = `bytes=${start}-${end}`;
  }

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching:\n${url}`);
  }

  return response.arrayBuffer();
}

/* ============================================================
   Gzip
   ============================================================ */

async function gunzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Browser does not support DecompressionStream.");
  }

  const stream = new Blob([buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));

  return new Response(stream).arrayBuffer();
}

async function decodeBuffer(
  buffer: ArrayBuffer,
  encoding: "raw" | "gzip",
): Promise<ArrayBuffer> {
  if (encoding === "raw") {
    return buffer;
  }

  return gunzip(buffer);
}

/* ============================================================
   Legacy mesh
   ============================================================ */

function decodeLegacyMesh(buffer: ArrayBuffer): THREE.BufferGeometry {
  const view = new DataView(buffer);

  if (buffer.byteLength < 4) {
    throw new Error("Legacy mesh fragment is too small.");
  }

  const vertexCount = view.getUint32(0, true);

  const vertexBytes = vertexCount * 3 * 4;

  const vertexStart = 4;

  const vertexEnd = vertexStart + vertexBytes;

  if (vertexEnd > buffer.byteLength) {
    throw new Error("Invalid legacy mesh vertex section.");
  }

  const vertices = new Float32Array(buffer, vertexStart, vertexCount * 3);

  const remaining = buffer.byteLength - vertexEnd;

  if (remaining % 4 !== 0) {
    throw new Error("Invalid legacy mesh index section.");
  }

  const indexCount = remaining / 4;

  if (indexCount % 3 !== 0) {
    throw new Error("Legacy mesh index count is not divisible by 3.");
  }

  const indices = new Uint32Array(buffer, vertexEnd, indexCount);

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  geometry.computeVertexNormals();

  return geometry;
}

/* ============================================================
   Mesh material
   ============================================================ */

function createMeshMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    opacity,
    transparent: opacity < 1,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0,
  });
}

/* ============================================================
   Mesh fragment loader
   ============================================================ */

async function loadLegacyMeshDataset(
  meshBaseURL: string,
  scene: THREE.Scene,
  color: THREE.ColorRepresentation,
  opacity: number,
  onObject?: (object: THREE.Object3D) => void,
): Promise<THREE.Object3D[]> {
  const infoURL = appendObjectPath(meshBaseURL, "info");

  const meshInfo = await fetchJSON<LegacyMeshInfo>(infoURL);

  if (meshInfo["@type"] !== "neuroglancer_legacy_mesh") {
    throw new Error(
      `Expected neuroglancer_legacy_mesh, received ${meshInfo["@type"]}`,
    );
  }

  const segmentPropertiesURL = appendObjectPath(
    meshBaseURL,
    "segment_properties/info",
  );

  let segmentProperties: SegmentProperties | null = null;

  try {
    segmentProperties =
      await fetchJSON<SegmentProperties>(segmentPropertiesURL);
  } catch {
    console.warn("No segment_properties found under mesh root.");
  }

  const ids = segmentProperties?.inline?.ids ?? [];

  const labels = segmentProperties?.inline?.properties?.[0]?.values ?? [];

  /*
   * Legacy mesh directories are:
   *
   *   mesh/<segment>:0
   *
   * The manifest contains:
   *
   *   {
   *     "fragments": [...]
   *   }
   */

  const objects: THREE.Object3D[] = [];

  /*
   * If segment properties are available,
   * load every segment.
   */
  if (ids.length > 0) {
    const jobs = ids.map(async (segmentId, index) => {
      const label = labels[index] ?? segmentId;

      const manifestURL = appendObjectPath(meshBaseURL, `${segmentId}:0`);

      const manifest = await fetchJSON<{
        fragments: string[];
      }>(manifestURL);

      console.log(`Segment ${segmentId} (${label})`, manifest.fragments);

      const material = createMeshMaterial(color, opacity);

      /*
       * Fetch fragments independently.
       *
       * Each fragment gets rendered as soon
       * as it arrives.
       */
      for (const fragment of manifest.fragments) {
        const fragmentURL = appendObjectPath(meshBaseURL, fragment);

        console.log(`Downloading ${label}: ${fragment}`);

        const buffer = await fetchArrayBuffer(fragmentURL);

        console.log(
          `${label} fragment downloaded: ` +
            `${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`,
        );

        const geometry = decodeLegacyMesh(buffer);

        const mesh = new THREE.Mesh(geometry, material.clone());

        mesh.name = `${label}:${fragment}`;

        scene.add(mesh);
        objects.push(mesh);

        onObject?.(mesh);

        console.log(`Rendered ${label}`);
      }
    });

    /*
     * Segments load concurrently.
     */
    await Promise.all(jobs);

    return objects;
  }

  /*
   * No segment properties.
   *
   * Try common numeric IDs until
   * there are no more.
   */
  for (let segmentId = 1; segmentId <= 3; segmentId++) {
    try {
      const manifestURL = appendObjectPath(meshBaseURL, `${segmentId}:0`);

      const manifest = await fetchJSON<{
        fragments: string[];
      }>(manifestURL);

      for (const fragment of manifest.fragments) {
        const fragmentURL = appendObjectPath(meshBaseURL, fragment);

        const buffer = await fetchArrayBuffer(fragmentURL);

        const geometry = decodeLegacyMesh(buffer);

        const mesh = new THREE.Mesh(
          geometry,
          createMeshMaterial(color, opacity),
        );

        scene.add(mesh);
        objects.push(mesh);

        onObject?.(mesh);
      }
    } catch {
      break;
    }
  }

  return objects;
}

/* ============================================================
   Multiscale volume
   ============================================================ */

async function loadMultiscaleVolume(
  infoURL: string,
  info: MultiscaleVolumeInfo,
  scene: THREE.Scene,
  color: THREE.ColorRepresentation,
  opacity: number,
  onObject?: (object: THREE.Object3D) => void,
): Promise<THREE.Object3D[]> {
  if (!info.mesh) {
    throw new Error("Multiscale volume has no mesh field.");
  }

  const volumeBase = getDatasetBaseURL(infoURL);

  /*
   * IMPORTANT:
   *
   * segment_properties belongs to the
   * volume root, while the mesh itself
   * is usually under /mesh.
   */
  let segmentProperties: SegmentProperties | null = null;

  if (info.segment_properties) {
    const segmentPropertiesURL = appendObjectPath(
      volumeBase,
      `${info.segment_properties}/info`,
    );

    try {
      segmentProperties =
        await fetchJSON<SegmentProperties>(segmentPropertiesURL);
    } catch {
      console.warn("Could not load volume segment properties.");
    }
  }

  const meshBase = appendObjectPath(volumeBase, info.mesh).replace(
    /\/info\?alt=media$/,
    "",
  );

  /*
   * If we have volume-level segment
   * properties, temporarily create the
   * manifests ourselves so that we don't
   * incorrectly look under mesh/segment_properties.
   */
  if (segmentProperties?.inline?.ids?.length) {
    const ids = segmentProperties.inline.ids;

    const labels = segmentProperties.inline.properties?.[0]?.values ?? [];

    const objects: THREE.Object3D[] = [];

    await Promise.all(
      ids.map(async (segmentId, index) => {
        const label = labels[index] ?? segmentId;

        const manifestURL = appendObjectPath(
          volumeBase,
          `${info.mesh}/${segmentId}:0`,
        );

        const manifest = await fetchJSON<{
          fragments: string[];
        }>(manifestURL);

        const material = createMeshMaterial(color, opacity);

        for (const fragment of manifest.fragments) {
          const fragmentURL = appendObjectPath(
            volumeBase,
            `${info.mesh}/${fragment}`,
          );

          console.log(`Downloading ${label}: ${fragment}`);

          const buffer = await fetchArrayBuffer(fragmentURL);

          console.log(
            `${label} fragment downloaded: ` +
              `${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`,
          );

          const geometry = decodeLegacyMesh(buffer);

          const mesh = new THREE.Mesh(geometry, material.clone());

          mesh.name = `${label}:${fragment}`;

          scene.add(mesh);
          objects.push(mesh);

          onObject?.(mesh);

          console.log(`Rendered ${label}`);
        }
      }),
    );

    return objects;
  }

  /*
   * Fallback to ordinary legacy mesh
   * loading.
   */
  return loadLegacyMeshDataset(meshBase, scene, color, opacity, onObject);
}

/* ============================================================
   Annotation helpers
   ============================================================ */

async function decodeAnnotationCompression(
  buffer: ArrayBuffer,
  encoding: "raw" | "gzip",
): Promise<ArrayBuffer> {
  return decodeBuffer(buffer, encoding);
}

/* ============================================================
   MurmurHash3 x86 128
   ============================================================ */

function rotl32(x: number, r: number): number {
  return ((x << r) | (x >>> (32 - r))) >>> 0;
}

function fmix32(h: number): number {
  h ^= h >>> 16;

  h = Math.imul(h, 0x85ebca6b) >>> 0;

  h ^= h >>> 13;

  h = Math.imul(h, 0xc2b2ae35) >>> 0;

  h ^= h >>> 16;

  return h >>> 0;
}

/*
 * MurmurHash3 x86 128 over an 8-byte
 * little-endian uint64 key.
 *
 * Neuroglancer uses the first 32-bit
 * hash word for minishard/shard selection.
 */
function murmurHash3_x86_128(value: bigint): Uint32Array {
  const bytes = new Uint8Array(8);

  let v = value;

  for (let i = 0; i < 8; i++) {
    bytes[i] = Number(v & 0xffn);

    v >>= 8n;
  }

  const data = new DataView(bytes.buffer);

  let h1 = 0;
  let h2 = 0;
  let h3 = 0;
  let h4 = 0;

  const c1 = 0x239b961b;
  const c2 = 0xab0e9789;
  const c3 = 0x38b34ae5;
  const c4 = 0xa1e38b93;

  let k1 = data.getUint32(0, true);

  let k2 = data.getUint32(4, true);

  k1 = Math.imul(k1, c1) >>> 0;

  k1 = rotl32(k1, 11);

  k1 = Math.imul(k1, c2) >>> 0;

  h1 ^= k1;

  h1 = rotl32(h1, 19);

  h1 = (h1 + h2) >>> 0;

  h1 = (Math.imul(h1, 5) + 0x561ccd1b) >>> 0;

  k2 = Math.imul(k2, c2) >>> 0;

  k2 = rotl32(k2, 16);

  k2 = Math.imul(k2, c3) >>> 0;

  h2 ^= k2;

  h2 = rotl32(h2, 17);

  h2 = (h2 + h3) >>> 0;

  h2 = (Math.imul(h2, 5) + 0x0bcaa747) >>> 0;

  h1 ^= 8;
  h2 ^= 8;
  h3 ^= 8;
  h4 ^= 8;

  const total = (h1 + h2 + h3 + h4) >>> 0;

  h1 = (h1 + total) >>> 0;

  h2 = (h2 + total) >>> 0;

  h3 = (h3 + total) >>> 0;

  h4 = (h4 + total) >>> 0;

  h1 = fmix32(h1);
  h2 = fmix32(h2);
  h3 = fmix32(h3);
  h4 = fmix32(h4);

  const total2 = (h1 + h2 + h3 + h4) >>> 0;

  h1 = (h1 + total2) >>> 0;

  h2 = (h2 + total2) >>> 0;

  h3 = (h3 + total2) >>> 0;

  h4 = (h4 + total2) >>> 0;

  return new Uint32Array([h1, h2, h3, h4]);
}

/* ============================================================
   Read annotation properties
   ============================================================ */

function readAnnotationProperty(
  view: DataView,
  offset: number,
  property: AnnotationProperty,
): {
  value: number | number[];
  nextOffset: number;
} {
  switch (property.type) {
    case "uint8":
      return {
        value: view.getUint8(offset),
        nextOffset: offset + 1,
      };

    case "int8":
      return {
        value: view.getInt8(offset),
        nextOffset: offset + 1,
      };

    case "uint16":
      return {
        value: view.getUint16(offset, true),
        nextOffset: offset + 2,
      };

    case "int16":
      return {
        value: view.getInt16(offset, true),
        nextOffset: offset + 2,
      };

    case "uint32":
      return {
        value: view.getUint32(offset, true),
        nextOffset: offset + 4,
      };

    case "int32":
      return {
        value: view.getInt32(offset, true),
        nextOffset: offset + 4,
      };

    case "float32":
      return {
        value: view.getFloat32(offset, true),
        nextOffset: offset + 4,
      };

    case "rgb":
      return {
        value: [
          view.getUint8(offset),
          view.getUint8(offset + 1),
          view.getUint8(offset + 2),
        ],
        nextOffset: offset + 3,
      };

    case "rgba":
      return {
        value: [
          view.getUint8(offset),
          view.getUint8(offset + 1),
          view.getUint8(offset + 2),
          view.getUint8(offset + 3),
        ],
        nextOffset: offset + 4,
      };

    default:
      throw new Error(`Unsupported annotation property type: ${property.type}`);
  }
}

/* ============================================================
   Decode one annotation record
   ============================================================ */

function decodePointAnnotation(
  buffer: ArrayBuffer,
  id: bigint,
  info: AnnotationInfo,
): PointAnnotation {
  const view = new DataView(buffer);

  let offset = 0;

  /*
   * Point annotations:
   *
   * x
   * y
   * z
   *
   * float32 each.
   */
  const x = view.getFloat32(offset, true);

  offset += 4;

  const y = view.getFloat32(offset, true);

  offset += 4;

  const z = view.getFloat32(offset, true);

  offset += 4;

  const properties: Record<string, number | number[]> = {};

  for (const property of info.properties ?? []) {
    const result = readAnnotationProperty(view, offset, property);

    properties[property.id] = result.value;

    offset = result.nextOffset;
  }

  return {
    id,
    position: [x, y, z],
    properties,
  };
}

/* ============================================================
   Parse minishard index
   ============================================================ */

type AnnotationChunk = {
  id: bigint;
  offset: number;
  size: number;
};

function parseMinishardIndex(
  buffer: ArrayBuffer,
  baseOffset: number,
): AnnotationChunk[] {
  /*
   * Each entry is:
   *
   *   uint64 id delta
   *   uint64 offset delta
   *   uint64 size
   */
  if (buffer.byteLength % 24 !== 0) {
    throw new Error(`Invalid minishard index size: ${buffer.byteLength}`);
  }

  const view = new DataView(buffer);

  const count = buffer.byteLength / 24;

  let idAccumulator = 0n;

  let offsetAccumulator = BigInt(baseOffset);

  const result: AnnotationChunk[] = [];

  for (let i = 0; i < count; i++) {
    const base = i * 24;

    const idDelta = view.getBigUint64(base, true);

    const offsetDelta = view.getBigUint64(base + 8, true);

    const size = view.getBigUint64(base + 16, true);

    idAccumulator += idDelta;

    offsetAccumulator += offsetDelta;

    result.push({
      id: idAccumulator,
      offset: Number(offsetAccumulator),
      size: Number(size),
    });

    offsetAccumulator += size;
  }

  return result;
}

/* ============================================================
   Create point batch
   ============================================================ */

function createPointCloud(
  points: PointAnnotation[],
  scale: number,
): THREE.Points {
  const positions = new Float32Array(points.length * 3);

  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i].position[0] * scale;

    positions[i * 3 + 1] = points[i].position[1] * scale;

    positions[i * 3 + 2] = points[i].position[2] * scale;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xff3355,
    size: 2.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
  });

  return new THREE.Points(geometry, material);
}

/* ============================================================
   Annotation loader
   ============================================================ */

async function loadAnnotations(
  infoURL: string,
  scene: THREE.Scene,
  onObject?: (object: THREE.Object3D) => void,
): Promise<void> {
  const info = await fetchJSON<AnnotationInfo>(infoURL);

  console.log("ANNOTATION INFO:", info);

  if (info["@type"] !== "neuroglancer_annotations_v1") {
    throw new Error(
      `Expected neuroglancer_annotations_v1, got ${info["@type"]}`,
    );
  }

  const annotationType = info.annotation_type.toLowerCase();

  if (annotationType !== "point") {
    throw new Error(
      `Only point annotations are currently supported. Got ${info.annotation_type}`,
    );
  }

  if (!info.by_id?.sharding) {
    throw new Error("Annotation dataset has no by_id sharding information.");
  }

  const sharding = info.by_id.sharding;

  const baseURL = getDatasetBaseURL(infoURL);

  /*
   * Your soma-point dataset uses:
   *
   *   by_id
   *   sharded
   *   gzip
   *
   * We use the sharded by_id index to retrieve
   * the complete set of points.
   */
  const {
    key,
    minishard_bits,
    shard_bits,
    minishard_index_encoding,
    data_encoding,
  } = sharding
    ? {
        key: info.by_id.key,
        minishard_bits: sharding.minishard_bits,
        shard_bits: sharding.shard_bits,
        minishard_index_encoding: sharding.minishard_index_encoding,
        data_encoding: sharding.data_encoding,
      }
    : (() => {
        throw new Error("Missing annotation sharding.");
      })();

  const shardCount = 2 ** shard_bits;

  const minishardCount = 2 ** minishard_bits;

  const shardIndexBytes = minishardCount * 16;

  /*
   * Neuroglancer coordinate dimensions
   * are physical units.
   *
   * The soma points and mesh coordinates
   * are both represented in dataset coordinates,
   * so default to 1 here.
   */
  const coordinateScale = 1;

  let totalPoints = 0;

  for (let shardNumber = 0; shardNumber < shardCount; shardNumber++) {
    /*
     * shard_bits == 0 means one shard.
     *
     * For >0 shards this produces the
     * zero-padded hexadecimal shard name.
     */
    const shardWidth = Math.ceil(shard_bits / 4);

    const shardName = shardNumber.toString(16).padStart(shardWidth, "0");

    const shardURL = appendObjectPath(baseURL, `${key}/${shardName}.shard`);

    console.log(`[soma] loading shard ${shardName}`);

    /*
     * Fetch the fixed shard index.
     */
    const shardIndexBuffer = await fetchArrayBuffer(
      shardURL,
      0,
      shardIndexBytes - 1,
    );

    const shardIndex = new DataView(shardIndexBuffer);

    /*
     * Each minishard entry gives:
     *
     *   start
     *   end
     *
     * into the minishard index region.
     */
    for (let minishard = 0; minishard < minishardCount; minishard++) {
      const base = minishard * 16;

      const start = Number(shardIndex.getBigUint64(base, true));

      const end = Number(shardIndex.getBigUint64(base + 8, true));

      if (start === end) {
        continue;
      }

      const compressedIndex = await fetchArrayBuffer(
        shardURL,
        shardIndexBytes + start,
        shardIndexBytes + end - 1,
      );

      const decodedIndex = await decodeAnnotationCompression(
        compressedIndex,
        minishard_index_encoding,
      );

      const chunks = parseMinishardIndex(decodedIndex, shardIndexBytes + end);

      /*
       * Fetch actual annotation records.
       *
       * Do this in small batches so the browser
       * does not allocate thousands of requests
       * simultaneously.
       */
      const concurrency = 16;

      for (let i = 0; i < chunks.length; i += concurrency) {
        const batch = chunks.slice(i, i + concurrency);

        const points = await Promise.all(
          batch.map(async (chunk) => {
            const raw = await fetchArrayBuffer(
              shardURL,
              chunk.offset,
              chunk.offset + chunk.size - 1,
            );

            const decoded = await decodeAnnotationCompression(
              raw,
              data_encoding,
            );

            return decodePointAnnotation(decoded, chunk.id, info);
          }),
        );

        if (points.length > 0) {
          const pointCloud = createPointCloud(points, coordinateScale);

          scene.add(pointCloud);

          onObject?.(pointCloud);

          totalPoints += points.length;

          console.log(
            `[soma] rendered ${points.length} points ` +
              `(total ${totalPoints})`,
          );
        }
      }
    }
  }

  console.log(`[soma] complete: ${totalPoints} points`);
}

/* ============================================================
   Bounds
   ============================================================ */

function getSceneBounds(scene: THREE.Scene): THREE.Box3 {
  const box = new THREE.Box3();

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
      box.expandByObject(object);
    }
  });

  return box;
}

/* ============================================================
   Main component
   ============================================================ */

export default function BrainViewer({
  infoUrl,
  background = "white",
  opacity = 0.72,
  color = 0xbfc3c8,
  autoFit = true,
}: BrainViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    /* ========================================================
       Renderer
       ======================================================== */

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: background === "transparent",
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.setSize(container.clientWidth, container.clientHeight);

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.shadowMap.enabled = false;

    container.appendChild(renderer.domElement);

    /* ========================================================
       Scene
       ======================================================== */

    const scene = new THREE.Scene();

    if (background === "dark") {
      scene.background = new THREE.Color(0x111318);
    } else if (background === "white") {
      scene.background = new THREE.Color(0xffffff);
    } else {
      scene.background = null;
    }

    /* ========================================================
       Camera
       ======================================================== */

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.01,
      1000000,
    );

    camera.position.set(0, 0, 100);

    /* ========================================================
       Controls
       ======================================================== */

    const controls = new OrbitControls(camera, renderer.domElement);

    controls.enableDamping = true;

    controls.dampingFactor = 0.08;

    controls.rotateSpeed = 0.6;

    controls.zoomSpeed = 1.2;

    controls.panSpeed = 0.7;

    controls.screenSpacePanning = true;

    /* ========================================================
       Lighting
       ======================================================== */

    const ambient = new THREE.AmbientLight(0xffffff, 2.0);

    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 2.5);

    key.position.set(1, 1, 2);

    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 1.0);

    fill.position.set(-1, -0.5, -1);

    scene.add(fill);

    /* ========================================================
       Load
       ======================================================== */

    let disposed = false;

    const loadBrain = async () => {
      try {
        console.log("==========================================");

        console.log("DATASET INFO URL:", infoUrl);

        const info = await fetchJSON<DatasetInfo>(infoUrl);

        if (disposed) {
          return;
        }

        console.log("DATASET INFO:", info);

        const type = info["@type"];

        console.log("DATASET TYPE:", type);

        /* ==================================================
             LEGACY MESH
             ================================================== */

        if (type === "neuroglancer_legacy_mesh") {
          const baseURL = getDatasetBaseURL(infoUrl);

          await loadLegacyMeshDataset(baseURL, scene, color, opacity, () => {
            if (autoFit) {
              fitCamera();
            }
          });

          return;
        }

        /* ==================================================
             MULTISCALE VOLUME
             ================================================== */

        if (type === "neuroglancer_multiscale_volume") {
          await loadMultiscaleVolume(
            infoUrl,
            info,
            scene,
            color,
            opacity,
            () => {
              if (autoFit) {
                fitCamera();
              }
            },
          );

          return;
        }

        /* ==================================================
             ANNOTATIONS
             ================================================== */

        if (type === "neuroglancer_annotations_v1") {
          await loadAnnotations(infoUrl, scene, () => {
            if (autoFit) {
              fitCamera();
            }
          });

          return;
        }

        throw new Error(`Unsupported Neuroglancer dataset type: ${type}`);
      } catch (error) {
        console.error("Dataset loading failed:", error);
      }
    };

    /* ========================================================
       Camera fitting
       ======================================================== */

    function fitCamera() {
      const box = getSceneBounds(scene);

      if (box.isEmpty()) {
        return;
      }

      const center = box.getCenter(new THREE.Vector3());

      const size = box.getSize(new THREE.Vector3());

      const maxDimension = Math.max(size.x, size.y, size.z);

      if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
        return;
      }

      const distance =
        maxDimension / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

      const direction = new THREE.Vector3(1, 0.65, 1).normalize();

      camera.position
        .copy(center)
        .add(direction.multiplyScalar(distance * 1.25));

      camera.near = Math.max(maxDimension / 100000, 0.001);

      camera.far = Math.max(maxDimension * 100, 1000);

      camera.updateProjectionMatrix();

      controls.target.copy(center);

      controls.update();
    }

    /* ========================================================
       Resize
       ======================================================== */

    const resizeObserver = new ResizeObserver(() => {
      if (!container) {
        return;
      }

      const width = container.clientWidth;

      const height = container.clientHeight;

      camera.aspect = width / Math.max(height, 1);

      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    });

    resizeObserver.observe(container);

    /* ========================================================
       Animation
       ======================================================== */

    const clock = new THREE.Clock();

    let animationFrame = 0;

    const animate = () => {
      if (disposed) {
        return;
      }

      animationFrame = requestAnimationFrame(animate);

      controls.update();

      renderer.render(scene, camera);

      clock.getDelta();
    };

    animate();

    void loadBrain();

    /* ========================================================
       Cleanup
       ======================================================== */

    return () => {
      disposed = true;

      cancelAnimationFrame(animationFrame);

      resizeObserver.disconnect();

      controls.dispose();

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();

          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }

        if (object instanceof THREE.Points) {
          object.geometry.dispose();

          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();

      renderer.domElement.remove();

      scene.clear();
    };
  }, [infoUrl, background, opacity, color, autoFit]);

  return <div ref={containerRef} className="w-full h-full" />;
}
