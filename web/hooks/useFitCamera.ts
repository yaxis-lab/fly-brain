import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

import { CNS_CONFIG } from "../config/cns";
import type { CNSMesh } from "@/types/cns";

interface UseFitCameraOptions {
  readonly meshes: readonly CNSMesh[];
  readonly controls: React.RefObject<OrbitControlsImpl | null>;
}

export function useFitCamera({ meshes, controls }: UseFitCameraOptions): void {
  const { camera } = useThree();

  useEffect(() => {
    if (meshes.length === 0) {
      return;
    }

    const bounds = new THREE.Box3();

    for (const mesh of meshes) {
      mesh.geometry.computeBoundingBox();

      if (mesh.geometry.boundingBox) {
        bounds.union(mesh.geometry.boundingBox);
      }
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    bounds.getCenter(center);
    bounds.getSize(size);

    // Scene is rendered with Y inverted.
    center.y *= -1;

    const radius = size.length() * 0.5;

    camera.position.set(
      center.x,
      center.y,
      center.z + radius * CNS_CONFIG.camera.distanceMultiplier,
    );
    camera.near = Math.max(radius / CNS_CONFIG.camera.nearDivisor, 0.01);
    camera.far = radius * CNS_CONFIG.camera.farMultiplier;

    camera.updateProjectionMatrix();
    camera.lookAt(center);

    const orbitControls = controls.current;

    if (orbitControls) {
      orbitControls.target.copy(center);
      orbitControls.update();
    }
  }, [meshes, camera, controls]);
}
