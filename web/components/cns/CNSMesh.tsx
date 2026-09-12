import type { ThreeElements } from "@react-three/fiber";

import type { CNSMesh as CNSMeshData } from "@/types/cns";
import { AnatomicalMaterial } from "./materials/AnatomicalMaterial";
import { SilhouetteMaterial } from "./materials/SilhouetteMaterial";

interface CNSMeshProps {
  readonly mesh: CNSMeshData;
  readonly position?: ThreeElements["group"]["position"];
}

export function CNSMesh({ mesh, position = [0, 0, 0] }: CNSMeshProps) {
  const radius = mesh.geometry.boundingSphere?.radius ?? 100;

  return (
    <group position={position}>
      <mesh geometry={mesh.geometry} renderOrder={1}>
        <AnatomicalMaterial />
      </mesh>

      <mesh geometry={mesh.geometry} renderOrder={2}>
        <SilhouetteMaterial radius={radius} />
      </mesh>
    </group>
  );
}
