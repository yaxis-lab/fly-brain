import { useEffect, useState } from "react";

import { CNS_CONFIG } from "@/config/cns";
import type { CNSMesh } from "@/types/cns";
import { loadNgMesh } from "@/lib/meshes/ngmesh";
import { createMeshGeometry } from "@/lib/meshes/geometry";
import { createMeshStream } from "@/lib/meshes/stream";

export interface CNSMeshState {
  readonly meshes: readonly CNSMesh[];
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
}

export function useCNSMeshes(): CNSMeshState {
  const [meshes, setMeshes] = useState<CNSMesh[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMeshes(): Promise<void> {
      try {
        setErrorMessage(null);

        const stream = createMeshStream({
          items: CNS_CONFIG.meshes,

          load: async (spec): Promise<CNSMesh> => {
            const data = await loadNgMesh(spec.baseUrl, spec.segment);
            const geometry = createMeshGeometry(data);

            return {
              id: spec.id,
              part: spec.part,
              segment: spec.segment,
              geometry,
            };
          },

          onItemLoaded: (mesh) => {
            if (isCancelled) {
              mesh.geometry.dispose();
              return;
            }

            setMeshes((current) => [...current, mesh]);
          },
        });

        await stream.start();

        if (!isCancelled) {
          setIsLoading(false);
        }
      } catch (error) {
        if (!isCancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to load CNS meshes";

          setErrorMessage(message);
          setIsLoading(false);
        }
      }
    }

    void loadMeshes();

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    meshes,
    isLoading,
    errorMessage,
  };
}
