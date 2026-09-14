"use client";

import { useEffect, useState } from "react";

import { PrecomputedMeshSource } from "@/utils/neuroglancer/precomputed";
import { NeuronFragment } from "./NeuronFragment";

const BODY_ID = BigInt(10157);
const LOD = 3;

interface FragmentData {
  readonly id: number;
  readonly positions: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
}

export function TestNeuronBody() {
  const [fragments, setFragments] = useState<readonly FragmentData[]>([]);

  useEffect(() => {
    const source = new PrecomputedMeshSource();

    async function load() {
      console.log("Loading neuron manifest...");

      const manifestBuffer = await source.downloadManifest(BODY_ID);

      const manifest = source.decodeMultiscaleManifestChunk(manifestBuffer);

      const fragmentCount = manifest.numFragmentsPerLod[LOD];

      console.log("Neuron manifest loaded:", {
        bodyId: BODY_ID.toString(),
        lod: LOD,
        fragmentCount,
      });

      const loadedFragments = await Promise.all(
        Array.from(
          { length: fragmentCount },
          async (_, fragmentIndex): Promise<FragmentData> => {
            const decoded = await source.loadMultiscaleFragment(
              BODY_ID,
              LOD,
              fragmentIndex,
              manifest,
            );

            return {
              id: fragmentIndex,
              positions: decoded.positions,
              indices: decoded.meshData.indices,
            };
          },
        ),
      );

      console.log("Neuron fragments loaded:", {
        count: loadedFragments.length,
      });

      setFragments(loadedFragments);
    }

    void load();
  }, []);

  return (
    <>
      {fragments.map((fragment) => (
        <NeuronFragment
          key={fragment.id}
          bodyId={BODY_ID}
          positions={fragment.positions}
          indices={fragment.indices}
        />
      ))}
    </>
  );
}
