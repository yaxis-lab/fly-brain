"use client";

import { useMemo } from "react";
import * as THREE from "three";

interface NeuronFragmentProps {
  bodyId: bigint;
  readonly positions: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
}

export function NeuronFragment({
  bodyId,
  positions,
  indices,
}: NeuronFragmentProps) {
  const color = getNeuronColor(bodyId);
  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();

    nextGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );

    nextGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

    nextGeometry.computeVertexNormals();
    nextGeometry.computeBoundingBox();
    nextGeometry.computeBoundingSphere();

    return nextGeometry;
  }, [positions, indices]);

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        metalness={0}
      />
    </mesh>
  );
}

export function getNeuronColor(bodyId: bigint): THREE.Color {
  let hash = bodyId;

  hash = ((hash >> BigInt(16)) ^ hash) * BigInt(0x45d9f3b);
  hash = ((hash >> BigInt(16)) ^ hash) * BigInt(0x45d9f3b);
  hash = (hash >> BigInt(16)) ^ hash;

  const hue = Number(hash & BigInt(0xffffffff)) / 0xffffffff;

  return new THREE.Color().setHSL(hue, 0.85, 0.3);
}
