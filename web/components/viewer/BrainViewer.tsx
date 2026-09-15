import { ViewerCanvas } from "./ViewerCanvas";
import { useCNSMeshes } from "@/hooks/useCNSMeshes";

export function BrainViewer() {
  const { meshes } = useCNSMeshes();

  return (
    <section className="relative w-full h-full">
      <ViewerCanvas meshes={meshes} />
    </section>
  );
}
