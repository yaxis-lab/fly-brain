import {
  FragmentStreamRequest,
  MeshFragment,
} from "@/utils/neuroglancer/mesh/types";
import {
  MultiscaleManifest,
  PrecomputedMeshSource,
} from "@/utils/neuroglancer/precomputed";
import { useCallback } from "react";

export interface FragmentStream {
  start(): Promise<void>;
}

export interface FragmentStreamOptions {
  readonly source: PrecomputedMeshSource;
  readonly manifest: MultiscaleManifest;
  readonly request: FragmentStreamRequest;
  readonly onFragmentLoaded: (fragment: MeshFragment) => void;
}

export function useFragmentStream() {
  const createFragmentStream = useCallback(
    (options: FragmentStreamOptions): FragmentStream => {
      const { manifest, onFragmentLoaded, request, source } = options;

      return {
        async start(): Promise<void> {
          await Promise.all(
            Array.from(
              { length: request.fragmentCount },
              async (_, fragmentIndex) => {
                const decoded = await source.loadMultiscaleFragment(
                  request.bodyId,
                  request.lod,
                  fragmentIndex,
                  manifest,
                );

                onFragmentLoaded({
                  id: fragmentIndex,
                  positions: decoded.positions,
                  indices: decoded.meshData.indices,
                });
              },
            ),
          );
        },
      };
    },
    [],
  );

  return {
    createFragmentStream,
  };
}
