import { useEffect, useState } from "react";

import { CNS_CONFIG } from "@/config/cns";
import type { CNSMesh } from "@/types/cns";
import { loadNgMesh } from "@/lib/meshes/ngmesh";
import { createMeshGeometry } from "@/lib/meshes/geometry";

export interface CNSMeshState {
  readonly meshes: readonly CNSMesh[];
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
}

export function useCNSMeshes(): CNSMeshState {
  const [meshes, setMeshes] = useState<readonly CNSMesh[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMeshes(): Promise<void> {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const loadedMeshes = await Promise.all(
          CNS_CONFIG.meshes.map(async (spec): Promise<CNSMesh> => {
            const data = await loadNgMesh(spec.baseUrl, spec.segment);

            const geometry = createMeshGeometry(data);

            return {
              id: spec.id,
              part: spec.part,
              segment: spec.segment,
              geometry,
            };
          }),
        );

        if (isCancelled) {
          for (const mesh of loadedMeshes) {
            mesh.geometry.dispose();
          }

          return;
        }

        setMeshes(loadedMeshes);
      } catch (error) {
        if (!isCancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to load CNS meshes";

          setErrorMessage(message);
        }
      } finally {
        if (!isCancelled) {
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
