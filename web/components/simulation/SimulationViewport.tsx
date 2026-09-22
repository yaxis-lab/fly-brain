"use client";

import { useLoader, useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type {
  FlyState,
  SimulationRealtimeScene,
} from "@/types/simulation";

const MATERIAL_COLORS: Record<string, string> = {
  wing: "#cbd5e1",
  eye: "#ab361f",
  arista: "#423329",
  haltere: "#966e3d",
  headthorax: "#966332",
  antennaproboscis: "#966332",
  abdomen12345: "#966332",
  abdomen6: "#633300",
  coxa: "#966332",
  trochanterfemur: "#a16e29",
  tibia: "#ab7833",
  tarsus: "#b5823d",
};

interface SimulationViewportProps {
  readonly scene: SimulationRealtimeScene | null;
  readonly flyState: FlyState | null;
}

function quaternionFromMuJoCo(rotation: number[] | undefined) {
  if (rotation === undefined || rotation.length < 4) {
    return new THREE.Quaternion();
  }

  return new THREE.Quaternion(rotation[1], rotation[2], rotation[3], rotation[0]);
}

function bodyPosition(positions: number[][] | undefined, index: number) {
  const position = positions?.[index];
  return position?.length === 3
    ? ([position[0], position[1], position[2]] as [number, number, number])
    : ([0, 0, 0.8] as [number, number, number]);
}

function CheckerGround({ scene }: { readonly scene: SimulationRealtimeScene }) {
  const { size, position, checker_a, checker_b, repeat } = scene.ground;
  const checkerA = checker_a.map((channel) => Math.round(channel * 255)).join(",");
  const checkerB = checker_b.map((channel) => Math.round(channel * 255)).join(",");
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");

    if (context === null) {
      return null;
    }

    context.fillStyle = `rgb(${checkerA})`;
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = `rgb(${checkerB})`;
    context.fillRect(0, 0, 32, 32);
    context.fillRect(32, 32, 32, 32);

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.wrapS = THREE.RepeatWrapping;
    canvasTexture.wrapT = THREE.RepeatWrapping;
    canvasTexture.repeat.set(repeat, repeat);
    canvasTexture.anisotropy = 4;
    return canvasTexture;
  }, [checkerA, checkerB, repeat]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (texture === null) {
    return null;
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={position as [number, number, number]}
      receiveShadow
    >
      <planeGeometry args={[size[0] * 2, size[1] * 2]} />
      <meshStandardMaterial map={texture} roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

function FlyGeometry({
  scene,
  flyState,
}: {
  readonly scene: SimulationRealtimeScene;
  readonly flyState: FlyState | null;
}) {
  const urls = scene.body_segments.map(
    (segment) => `/flygym/neuromechfly/meshes/${segment.asset}`,
  );
  const geometries = useLoader(STLLoader, urls) as THREE.BufferGeometry[];

  return (
    <group>
      {scene.body_segments.map((segment, index) => {
        const color = MATERIAL_COLORS[segment.material] ?? "#966332";
        const opacity = segment.material === "wing" ? 0.34 : 1;

        return (
          <mesh
            key={segment.name}
            geometry={geometries[index]}
            position={bodyPosition(flyState?.body_positions, index)}
            quaternion={quaternionFromMuJoCo(flyState?.body_rotations[index])}
            scale={segment.mirror_y ? [1000, -1000, 1000] : [1000, 1000, 1000]}
            castShadow
          >
            <meshStandardMaterial
              color={color}
              transparent={opacity < 1}
              opacity={opacity}
              roughness={0.58}
              metalness={0.04}
              side={THREE.DoubleSide}
              depthWrite={opacity === 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function CameraFollow({
  scene,
  flyState,
}: {
  readonly scene: SimulationRealtimeScene;
  readonly flyState: FlyState | null;
}) {
  const camera = useThree((state) => state.camera);
  const target = useRef(new THREE.Vector3());
  const desiredPosition = useRef(new THREE.Vector3());
  const viewTarget = useRef(new THREE.Vector3());
  const viewMatrix = useRef(new THREE.Matrix4());
  const viewUp = useRef(new THREE.Vector3());
  const viewForward = useRef(new THREE.Vector3());
  const rootIndex = scene.body_segments.findIndex(
    (segment) => segment.name === scene.root_segment,
  );

  useFrame((_, delta) => {
    const root = bodyPosition(flyState?.body_positions, rootIndex);
    target.current.set(root[0], root[1], root[2]);

    const offset = scene.camera.position;
    desiredPosition.current.set(
      root[0] + offset[0],
      root[1] + offset[1],
      root[2] + offset[2],
    );

    camera.position.lerp(
      desiredPosition.current,
      1 - Math.exp(-Math.max(delta, 0.016) * 7),
    );

    const rotation = scene.camera.rotation_matrix;
    viewUp.current.set(rotation[0][1], rotation[1][1], rotation[2][1]);
    viewForward.current.set(-rotation[0][2], -rotation[1][2], -rotation[2][2]);
    viewTarget.current.copy(camera.position).add(viewForward.current);
    viewMatrix.current.lookAt(camera.position, viewTarget.current, viewUp.current);
    camera.quaternion.setFromRotationMatrix(viewMatrix.current);
  });

  return null;
}

export function SimulationViewport({
  scene,
  flyState,
}: SimulationViewportProps) {
  if (scene === null) {
    return null;
  }

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={scene.camera.fov}
        near={0.01}
        far={10_000}
        position={scene.camera.position as [number, number, number]}
        up={[0, 0, 1]}
      />
      <color attach="background" args={["#071210"]} />
      <fog attach="fog" args={["#071210", 42, 180]} />
      <hemisphereLight args={["#dce9e3", "#1f2a25", 0.42]} />
      {scene.lights.length > 0 ? (
        scene.lights.map((light, index) => (
          <directionalLight
            key={index}
            position={light.position as [number, number, number]}
            color={new THREE.Color(...light.diffuse)}
            intensity={0.82}
          />
        ))
      ) : (
        <directionalLight position={[-6, -8, 12]} color="#fff0d4" intensity={1.25} />
      )}
      <CheckerGround scene={scene} />
      <Suspense
        fallback={
          <mesh position={[0, 0, 1]}>
            <sphereGeometry args={[0.35, 20, 12]} />
            <meshStandardMaterial color="#6ee7b7" emissive="#174f42" />
          </mesh>
        }
      >
        <FlyGeometry scene={scene} flyState={flyState} />
      </Suspense>
      <CameraFollow scene={scene} flyState={flyState} />
    </>
  );
}
