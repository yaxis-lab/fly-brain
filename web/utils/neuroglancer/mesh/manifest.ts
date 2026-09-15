import type { PrecomputedMeshSource, MultiscaleManifest } from "../precomputed";

export interface LoadedManifest {
  readonly manifest: MultiscaleManifest;
  readonly fragmentCount: number;
}

export async function loadMultiscaleManifest(
  source: PrecomputedMeshSource,
  bodyId: bigint,
  lod: number,
): Promise<LoadedManifest> {
  const manifestBuffer = await source.downloadManifest(bodyId);
  const manifest = source.decodeMultiscaleManifestChunk(manifestBuffer);
  const fragmentCount = manifest.numFragmentsPerLod[lod];

  if (fragmentCount === undefined) {
    throw new Error(`No fragment count available for LOD ${lod}`);
  }

  return {
    manifest,
    fragmentCount,
  };
}
