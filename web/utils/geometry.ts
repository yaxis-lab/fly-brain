import * as THREE from "three";
import type { CNSMesh } from "@/types/cns";

export function calculateVncShift(
  meshes: readonly CNSMesh[],
  shiftFraction: number,
): THREE.Vector3 {
  const brainMeshes = meshes.filter((mesh) => mesh.part === "brain");
  const vncMesh = meshes.find((mesh) => mesh.part === "vnc");

  if (brainMeshes.length === 0 || !vncMesh) {
    return new THREE.Vector3();
  }

  const brainBounds = new THREE.Box3();
  for (const mesh of brainMeshes) {
    mesh.geometry.computeBoundingBox();

    if (mesh.geometry.boundingBox) {
      brainBounds.union(mesh.geometry.boundingBox);
    }
  }

  vncMesh.geometry.computeBoundingBox();
  if (!vncMesh.geometry.boundingBox) {
    return new THREE.Vector3();
  }

  const brainCenter = new THREE.Vector3();
  const vncCenter = new THREE.Vector3();

  brainBounds.getCenter(brainCenter);
  vncMesh.geometry.boundingBox.getCenter(vncCenter);

  const direction = brainCenter.clone().sub(vncCenter);
  const distance = direction.length();

  if (distance === 0) {
    return new THREE.Vector3();
  }

  direction.normalize();

  return direction.multiplyScalar(distance * shiftFraction);
}
