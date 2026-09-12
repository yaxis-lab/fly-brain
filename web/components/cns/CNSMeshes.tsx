import type { CNSMesh } from "@/types/cns";
import { CNS_CONFIG } from "@/config/cns";
import { calculateVncShift } from "@/utils/geometry";
import { CNSMesh as CNSMeshComponent } from "./CNSMesh";

interface CNSMeshesProps {
  readonly meshes: readonly CNSMesh[];
}

export function CNSMeshes({ meshes }: CNSMeshesProps) {
  const vncShift = calculateVncShift(meshes, CNS_CONFIG.vnc.shiftFraction);

  return (
    <>
      {meshes
        .filter((mesh) => mesh.part === "brain")
        .map((mesh) => (
          <CNSMeshComponent key={mesh.id} mesh={mesh} />
        ))}

      {meshes
        .filter((mesh) => mesh.part === "vnc")
        .map((mesh) => (
          <CNSMeshComponent
            key={mesh.id}
            mesh={mesh}
            position={[vncShift.x, vncShift.y, vncShift.z]}
          />
        ))}
    </>
  );
}
