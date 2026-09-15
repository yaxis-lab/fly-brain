"use client";

import { useEffect, useMemo, useState } from "react";

import { NeuronFragment } from "./NeuronFragment";
import { useFragmentStream } from "@/hooks/useFragments";
import { MeshFragment } from "@/utils/neuroglancer/mesh/types";
import { PrecomputedMeshSource } from "@/utils/neuroglancer/precomputed";
import { loadMultiscaleManifest } from "@/utils/neuroglancer/mesh/manifest";
import { useNeurons } from "@/hooks/useNeuron";
export interface NeuronProps {
  lod?: number;
}

export function Neuron({ lod = 3 }: NeuronProps) {
  const source = useMemo(() => new PrecomputedMeshSource(), []);
  const { createFragmentStream } = useFragmentStream();
  const { selectedNeurons } = useNeurons();
  const [fragments, setFragments] = useState<Map<number, MeshFragment>>(
    () => new Map(),
  );
  const bodyId = useMemo(() => {
    if (selectedNeurons[0]) return selectedNeurons[0].bodyId;
  }, [selectedNeurons]);

  useEffect(() => {
    let active = true;

    async function loadNeuron(): Promise<void> {
      if (!bodyId) return;

      const { manifest, fragmentCount } = await loadMultiscaleManifest(
        source,
        BigInt(bodyId),
        lod,
      );

      if (!active) return;

      const stream = createFragmentStream({
        source,
        manifest,
        request: {
          bodyId: BigInt(bodyId),
          lod: lod,
          fragmentCount,
        },
        onFragmentLoaded: (fragment) => {
          if (!active) return;

          setFragments((current) => {
            const next = new Map(current);
            next.set(fragment.id, fragment);
            return next;
          });
        },
      });

      await stream.start();
    }

    void loadNeuron();

    return () => {
      active = false;
    };
  }, [source, createFragmentStream, bodyId, lod]);

  if (!bodyId) return null;
  return (
    <>
      {Array.from(fragments.values()).map((fragment) => (
        <NeuronFragment
          key={fragment.id}
          bodyId={BigInt(bodyId)}
          positions={fragment.positions}
          indices={fragment.indices}
        />
      ))}
    </>
  );
}
