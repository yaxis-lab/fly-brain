import type {
  MainModule,
  MjData,
  MjModel,
  MjvCamera,
  MjvOption,
  MjvPerturb,
  MjvScene,
} from "@mujoco/mujoco";

import type {
  FlyState,
  SimulationRealtimeScene,
} from "@/types/simulation";

export interface MujocoRuntime {
  disposed: boolean;
  readonly mujoco: MainModule;
  readonly model: MjModel;
  readonly data: MjData;
  readonly scene: MjvScene;
  readonly option: MjvOption;
  readonly perturb: MjvPerturb;
  readonly camera: MjvCamera;
  readonly segmentGeomIds: number[];
}

function xmlNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(8) : "0";
}

function xmlVector(values: number[]) {
  return values.map(xmlNumber).join(" ");
}

function quaternionFromRotationMatrix(matrix: number[][]) {
  const m00 = matrix[0]?.[0] ?? 1;
  const m01 = matrix[0]?.[1] ?? 0;
  const m02 = matrix[0]?.[2] ?? 0;
  const m10 = matrix[1]?.[0] ?? 0;
  const m11 = matrix[1]?.[1] ?? 1;
  const m12 = matrix[1]?.[2] ?? 0;
  const m20 = matrix[2]?.[0] ?? 0;
  const m21 = matrix[2]?.[1] ?? 0;
  const m22 = matrix[2]?.[2] ?? 1;
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [0.25 * s, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [(m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s];
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s];
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s];
}

function rgbaForMaterial(material: string) {
  const colors: Record<string, [number, number, number, number]> = {
    wing: [0.8, 0.8, 0.9, 0.3],
    eye: [0.67, 0.21, 0.12, 1],
    arista: [0.26, 0.2, 0.16, 1],
    haltere: [0.59, 0.43, 0.24, 1],
    headthorax: [0.59, 0.39, 0.12, 1],
    antennaproboscis: [0.59, 0.39, 0.12, 1],
    abdomen12345: [0.7, 0.51, 0.25, 1],
    abdomen6: [0.6, 0.31, 0.04, 1],
    coxa: [0.59, 0.39, 0.12, 1],
    trochanterfemur: [0.63, 0.43, 0.16, 1],
    tibia: [0.67, 0.47, 0.2, 1],
    tarsus: [0.71, 0.51, 0.24, 1],
  };
  return colors[material] ?? colors.tarsus;
}

export function createMuJoCoModelXml(scene: SimulationRealtimeScene) {
  const root = scene.root_segment;
  const cameraQuaternion = quaternionFromRotationMatrix(
    scene.camera.rotation_matrix,
  );
  const camera = `<camera name="trackingcam" pos="${xmlVector(scene.camera.position)}" quat="${xmlVector(cameraQuaternion)}" fovy="${xmlNumber(scene.camera.fov)}"/>`;
  const bodies = scene.body_segments
    .map((segment) => {
      const rgba = rgbaForMaterial(segment.material);
      const isRoot = segment.name === root;
      return `<body name="${segment.name}" pos="0 0 0">
        <freejoint name="${segment.name}_free"/>
        <geom name="${segment.name}_scene_geom" type="mesh" mesh="${segment.name}_mesh" rgba="${xmlVector(rgba)}" contype="0" conaffinity="0"/>
        ${isRoot ? camera : ""}
      </body>`;
    })
    .join("\n");
  const ground = scene.ground;

  const assets = scene.body_segments
    .map((segment) => {
      const scale = segment.mirror_y ? "1000 -1000 1000" : "1000 1000 1000";
      return `<mesh name="${segment.name}_mesh" file="/working/${segment.asset}" scale="${scale}"/>`;
    })
    .join("\n");

  return `<mujoco model="flygym-browser-scene">
    <compiler angle="radian" coordinate="local"/>
    <option gravity="0 0 -9.81" timestep="0.001"/>
    <asset>
      ${assets}
    </asset>
    <visual>
      <global offwidth="2048" offheight="2048"/>
      <headlight ambient="0.35 0.35 0.35" diffuse="0.7 0.7 0.7" specular="0.1 0.1 0.1"/>
    </visual>
    <worldbody>
      <geom name="ground" type="plane" pos="${xmlVector(ground.position)}" size="${xmlVector(ground.size)} 0.1" rgba="0.35 0.35 0.35 1" contype="0" conaffinity="0"/>
      ${bodies}
    </worldbody>
  </mujoco>`;
}

export function setMuJoCoState(
  runtime: MujocoRuntime,
  flyState: FlyState | null,
) {
  if (flyState === null) {
    return;
  }

  const qpos = runtime.data.qpos;
  runtime.segmentGeomIds.forEach((geomId, index) => {
    const bodyId = Number(runtime.model.geom_bodyid[geomId]);
    const jointId = Number(runtime.model.body_jntadr[bodyId]);
    const qposAddress = Number(runtime.model.jnt_qposadr[jointId]);
    const position = flyState.body_positions[index];
    const rotation = flyState.body_rotations[index];

    if (position?.length === 3 && rotation?.length === 4) {
      qpos[qposAddress] = position[0];
      qpos[qposAddress + 1] = position[1];
      qpos[qposAddress + 2] = position[2];
      qpos[qposAddress + 3] = rotation[0];
      qpos[qposAddress + 4] = rotation[1];
      qpos[qposAddress + 5] = rotation[2];
      qpos[qposAddress + 6] = rotation[3];
    }
  });

  runtime.mujoco.mj_forward(runtime.model, runtime.data);
}

export async function createMuJoCoRuntime(
  mujoco: MainModule,
  sceneDescription: SimulationRealtimeScene,
): Promise<MujocoRuntime> {
  try {
    mujoco.FS.mkdir("/working");
  } catch {
    // The virtual filesystem persists for the lifetime of the WASM module.
  }

  const assets = [...new Set(sceneDescription.body_segments.map((segment) => segment.asset))];
  await Promise.all(
    assets.map(async (asset) => {
      const response = await fetch(`/flygym/neuromechfly/meshes/${asset}`);
      if (!response.ok) {
        throw new Error(`Unable to load MuJoCo mesh asset: ${asset}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      mujoco.FS.writeFile(`/working/${asset}`, bytes);
    }),
  );

  const model = mujoco.MjModel.from_xml_string(
    createMuJoCoModelXml(sceneDescription),
  );
  const data = new mujoco.MjData(model);
  const scene = new mujoco.MjvScene(
    model,
    Math.max(256, sceneDescription.body_segments.length + 8),
  );
  const option = new mujoco.MjvOption();
  const perturb = new mujoco.MjvPerturb();
  const camera = new mujoco.MjvCamera();
  mujoco.mjv_defaultFreeCamera(model, camera);

  const segmentGeomIds = sceneDescription.body_segments.map((_, index) => index + 1);

  return {
    disposed: false,
    mujoco,
    model,
    data,
    scene,
    option,
    perturb,
    camera,
    segmentGeomIds,
  };
}

export function updateMuJoCoScene(runtime: MujocoRuntime) {
  runtime.mujoco.mjv_updateScene(
    runtime.model,
    runtime.data,
    runtime.option,
    runtime.perturb,
    runtime.camera,
    runtime.mujoco.mjtCatBit.mjCAT_ALL.value,
    runtime.scene,
  );
}

export function disposeMuJoCoRuntime(runtime: MujocoRuntime) {
  if (runtime.disposed) {
    return;
  }
  runtime.disposed = true;
  runtime.scene.delete();
  runtime.camera.delete();
  runtime.perturb.delete();
  runtime.option.delete();
  runtime.data.delete();
  runtime.model.delete();
}
