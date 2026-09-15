"use client";

import { useEffect, useMemo, useState } from "react";

import { NeuronFragment } from "./NeuronFragment";
import { useFragmentStream } from "@/hooks/useFragments";
import { MeshFragment } from "@/utils/neuroglancer/mesh/types";
import { PrecomputedMeshSource } from "@/utils/neuroglancer/precomputed";
import { loadMultiscaleManifest } from "@/utils/neuroglancer/mesh/manifest";

const BODY_ID = BigInt(12781);
const LOD = 3;

export function Neuron() {
  const source = useMemo(() => new PrecomputedMeshSource(), []);
  const { createFragmentStream } = useFragmentStream();
  const [fragments, setFragments] = useState<Map<number, MeshFragment>>(
    () => new Map(),
  );

  useEffect(() => {
    let active = true;

    async function loadNeuron(): Promise<void> {
      const { manifest, fragmentCount } = await loadMultiscaleManifest(
        source,
        BODY_ID,
        LOD,
      );

      if (!active) return;

      const stream = createFragmentStream({
        source,
        manifest,
        request: {
          bodyId: BODY_ID,
          lod: LOD,
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
  }, [source, createFragmentStream]);

  return (
    <>
      {Array.from(fragments.values()).map((fragment) => (
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
