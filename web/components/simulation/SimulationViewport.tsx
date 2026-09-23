"use client";

import loadMujoco, { type MainModule } from "@mujoco/mujoco";
import { OrbitControls } from "@react-three/drei";
import { useLoader, useThree, useFrame } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import {
  createMuJoCoRuntime,
  disposeMuJoCoRuntime,
  setMuJoCoState,
  updateMuJoCoScene,
  type MujocoRuntime,
} from "@/lib/simulation/mujoco-scene";
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

function CheckerGround({ scene }: { readonly scene: SimulationRealtimeScene }) {
  const { size, position, checker_a, checker_b, repeat } = scene.ground;
  const checkerA = checker_a.map((channel) => Math.round(channel * 255)).join(",");
  const checkerB = checker_b.map((channel) => Math.round(channel * 255)).join(",");
  const texture = useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }
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
      position={position as [number, number, number]}
      receiveShadow
    >
      <planeGeometry args={[size[0] * 2, size[1] * 2]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function MuJoCoFly({
  sceneDescription,
  flyState,
  runtime,
  controls,
}: {
  readonly sceneDescription: SimulationRealtimeScene;
  readonly flyState: FlyState | null;
  readonly runtime: MujocoRuntime;
  readonly controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const urls = sceneDescription.body_segments.map(
    (segment) => `/flygym/neuromechfly/meshes/${segment.asset}`,
  );
  const geometries = useLoader(STLLoader, urls) as THREE.BufferGeometry[];
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const latestFlyState = useRef(flyState);
  const getState = useThree((state) => state.get);
  const sceneCamera = useRef(new THREE.Vector3());
  const sceneTarget = useRef(new THREE.Vector3());
  const sceneUp = useRef(new THREE.Vector3());
  const cameraRotation = useRef(new THREE.Matrix4());
  const cameraInitialized = useRef(false);

  useEffect(() => {
    latestFlyState.current = flyState;
  }, [flyState]);

  useFrame(() => {
    if (runtime.disposed) {
      return;
    }

    const threeCamera = getState().camera;
    setMuJoCoState(runtime, latestFlyState.current);
    updateMuJoCoScene(runtime);

    const geoms = runtime.scene.geoms;
    for (let geomIndex = 0; geomIndex < runtime.scene.ngeom; geomIndex += 1) {
      const geom = geoms.get(geomIndex);
      if (geom === undefined) {
        continue;
      }
      const index = runtime.segmentGeomIds.indexOf(geom.objid);
      const mesh = index >= 0 ? meshRefs.current[index] : null;
      if (mesh !== null) {
        const scale = sceneDescription.body_segments[index].mirror_y ? -1000 : 1000;
        const matrix = geom.mat;
        const position = geom.pos;
        mesh.matrixAutoUpdate = false;
        mesh.matrix.set(
          matrix[0] * 1000, matrix[1] * scale, matrix[2] * 1000, position[0],
          matrix[3] * 1000, matrix[4] * scale, matrix[5] * 1000, position[1],
          matrix[6] * 1000, matrix[7] * scale, matrix[8] * 1000, position[2],
          0, 0, 0, 1,
        );
        mesh.matrixWorldNeedsUpdate = true;
      }
      geom.delete();
    }
    geoms.delete();

    const cameras = runtime.scene.camera;
    const browserCamera = cameras.get(0);
    if (browserCamera !== undefined) {
      const position = browserCamera.pos;
      const forward = browserCamera.forward;
      const up = browserCamera.up;
      sceneCamera.current.set(position[0], position[1], position[2]);
      sceneTarget.current.set(
        position[0] + forward[0] * 8,
        position[1] + forward[1] * 8,
        position[2] + forward[2] * 8,
      );
      sceneUp.current.set(up[0], up[1], up[2]);
      cameraRotation.current.lookAt(
        sceneCamera.current,
        sceneTarget.current,
        sceneUp.current,
      );
      if (!cameraInitialized.current) {
        threeCamera.position.copy(sceneCamera.current);
        threeCamera.quaternion.setFromRotationMatrix(cameraRotation.current);
        threeCamera.up.copy(sceneUp.current);
        if (threeCamera instanceof THREE.PerspectiveCamera) {
          threeCamera.fov = sceneDescription.camera.fov;
          threeCamera.near = 0.01;
          threeCamera.far = 1_000;
          threeCamera.updateProjectionMatrix();
        }
        if (controls.current !== null) {
          controls.current.target.copy(sceneTarget.current);
          controls.current.update();
        }
        cameraInitialized.current = true;
      }
      browserCamera.delete();
    }
    cameras.delete();
  });

  return (
    <group>
      {sceneDescription.body_segments.map((segment, index) => {
        const color = MATERIAL_COLORS[segment.material] ?? "#966332";
        const opacity = segment.material === "wing" ? 0.34 : 1;

        return (
          <mesh
            key={segment.name}
            ref={(mesh) => {
              meshRefs.current[index] = mesh;
            }}
            geometry={geometries[index]}
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

function MuJoCoLoadingState() {
  return (
    <mesh position={[0, 0, 1]}>
      <sphereGeometry args={[0.35, 20, 12]} />
      <meshStandardMaterial color="#6ee7b7" emissive="#174f42" />
    </mesh>
  );
}

export function SimulationViewport({ scene, flyState }: SimulationViewportProps) {
  const [mujoco, setMujoco] = useState<MainModule | null>(null);
  const [runtime, setRuntime] = useState<MujocoRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controls = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    if (scene === null) {
      return;
    }

    let disposed = false;
    let createdRuntime: MujocoRuntime | null = null;

    void loadMujoco()
      .then((module) => {
        if (disposed) {
          return;
        }
        return createMuJoCoRuntime(module, scene).then((newRuntime) => {
          if (disposed) {
            disposeMuJoCoRuntime(newRuntime);
            return;
          }
          createdRuntime = newRuntime;
          setMujoco(module);
          setRuntime(newRuntime);
          setError(null);
        });
      })
      .catch((loadError: unknown) => {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : "MuJoCo WASM failed to initialize");
        }
      });

    return () => {
      disposed = true;
      setMujoco(null);
      setRuntime(null);
      if (createdRuntime !== null) {
        disposeMuJoCoRuntime(createdRuntime);
      }
    };
  }, [scene]);

  if (scene === null) {
    return null;
  }

  return (
    <>
      <color attach="background" args={["#071210"]} />
      <fog attach="fog" args={["#071210", 42, 180]} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={0.35}
        maxDistance={180}
        rotateSpeed={0.65}
        zoomSpeed={0.9}
        panSpeed={0.8}
      />
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
      {mujoco !== null && runtime !== null ? (
        <Suspense fallback={<MuJoCoLoadingState />}>
          <MuJoCoFly
            sceneDescription={scene}
            flyState={flyState}
            runtime={runtime}
            controls={controls}
          />
        </Suspense>
      ) : (
        <MuJoCoLoadingState />
      )}
      {error !== null ? <MuJoCoLoadingState /> : null}
    </>
  );
}
