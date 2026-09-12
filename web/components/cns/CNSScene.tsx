import { useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { CNS_CONFIG } from "@/config/cns";
import type { CNSMesh } from "@/types/cns";
import { useFitCamera } from "@/hooks/useFitCamera";
import { CNSMeshes } from "./CNSMeshes";

interface CNSSceneProps {
  readonly meshes: readonly CNSMesh[];
}

export function CNSScene({ meshes }: CNSSceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);

  useFitCamera({
    meshes,
    controls,
  });

  return (
    <>
      <group scale={CNS_CONFIG.coordinateSystem.scale}>
        <CNSMeshes meshes={meshes} />
      </group>

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}
