import { useLayoutEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { CNS_CONFIG } from "@/config/cns";
import type { CNSMesh } from "@/types/cns";
import { CNSMeshes } from "./CNSMeshes";
import { Neuron } from "./neuron/Neuron";

interface CNSSceneProps {
  readonly meshes: readonly CNSMesh[];
}

interface CNSContentProps {
  readonly meshes: readonly CNSMesh[];
}

function CNSContent({ meshes }: CNSContentProps) {
  const group = useRef<THREE.Group | null>(null);

  const getState = useThree((state) => state.get);

  useLayoutEffect(() => {
    if (group.current === null) {
      return;
    }

    const box = new THREE.Box3().setFromObject(group.current);

    if (box.isEmpty()) {
      return;
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    box.getCenter(center);
    box.getSize(size);

    const radius = size.length() * 0.5;

    const { camera, controls } = getState();

    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }

    const fovRadians = THREE.MathUtils.degToRad(camera.fov);

    const distance = (radius / Math.tan(fovRadians * 0.5)) * 1.25;

    camera.position.set(center.x, center.y, center.z + distance);

    camera.near = Math.max(radius / 1000, 0.1);
    camera.far = Math.max(distance + radius * 4, 1_000_000);

    camera.lookAt(center);
    camera.updateProjectionMatrix();

    const orbitControls = controls as OrbitControlsImpl | null;

    if (orbitControls !== null) {
      orbitControls.target.copy(center);
      orbitControls.update();
    }

    console.log("[CNS camera fit]", {
      center: center.toArray(),
      size: size.toArray(),
      radius,
      distance,
      camera: camera.position.toArray(),
      target: orbitControls?.target.toArray(),
    });
  }, [getState, meshes]);

  return (
    <group ref={group} scale={CNS_CONFIG.coordinateSystem.scale}>
      <CNSMeshes meshes={meshes} />
      <Neuron />
    </group>
  );
}

export function CNSScene({ meshes }: CNSSceneProps) {
  return (
    <>
      <CNSContent meshes={meshes} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}
