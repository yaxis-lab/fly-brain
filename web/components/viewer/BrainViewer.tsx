import { ViewerCanvas } from "./ViewerCanvas";
import { ViewerStatus } from "./ViewerStatus";
import { useCNSMeshes } from "@/hooks/useCNSMeshes";

export function BrainViewer() {
  const { meshes, isLoading, errorMessage } = useCNSMeshes();

  return (
    <main className="relative w-full h-full">
      <ViewerCanvas meshes={meshes} />

      <ViewerStatus isLoading={isLoading} errorMessage={errorMessage} />
    </main>
  );
}
