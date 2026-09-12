import type { MeshData } from "@/types/cns";
import { fetchJson } from "@/lib/fetchJson";
import { parseNgMesh } from "./ngmeshParser";

interface NgMeshManifest {
  readonly fragments?: readonly string[];
}

function createManifestUrl(baseUrl: string, segment: string): string {
  return `${baseUrl}%2Fmesh%2F${segment}%3A0?alt=media`;
}

function createFragmentUrl(baseUrl: string, fragment: string): string {
  return `${baseUrl}%2Fmesh%2F${encodeURIComponent(fragment)}?alt=media`;
}

export async function loadNgMesh(
  baseUrl: string,
  segment: string,
): Promise<MeshData> {
  const manifestUrl = createManifestUrl(baseUrl, segment);
  const manifest = await fetchJson<NgMeshManifest>(manifestUrl);
  const fragment = manifest.fragments?.[0];

  if (!fragment) {
    throw new Error(`No mesh fragment found for segment "${segment}"`);
  }

  const meshUrl = createFragmentUrl(baseUrl, fragment);
  const response = await fetch(meshUrl);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} while loading mesh segment "${segment}"`,
    );
  }

  const buffer = await response.arrayBuffer();

  return parseNgMesh(buffer, segment);
}
