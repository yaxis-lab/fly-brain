import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useState } from "react";

const BASE =
  "https://storage.googleapis.com/storage/v1/b/flyem-male-cns/o/rois%2Ffullbrain-major-shells";

type MeshData = {
  vertices: Float32Array;
  indices: Uint32Array;
};

async function fetchJSON(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.json();
}

async function loadNgMesh(segment: string): Promise<MeshData> {
  /*
   * Manifest:
   *
   * rois/fullbrain-major-shells/mesh/1:0
   */
  const manifestURL = `${BASE}%2Fmesh%2F${segment}%3A0?alt=media`;

  console.log(`[Neuroglancer mesh] manifest ${segment}:`, manifestURL);

  const manifest = await fetchJSON(manifestURL);

  if (!manifest.fragments?.length) {
    throw new Error(`No fragments found for segment ${segment}`);
  }

  const fragment = manifest.fragments[0];

  /*
   * Fragment:
   *
   * rois/fullbrain-major-shells/mesh/<fragment>
   */
  const meshURL = `${BASE}%2Fmesh%2F${encodeURIComponent(fragment)}?alt=media`;

  console.log(`[Neuroglancer mesh] fragment ${segment}:`, meshURL);

  const response = await fetch(meshURL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} loading mesh ${segment}`);
  }

  const buffer = await response.arrayBuffer();

  if (buffer.byteLength < 4) {
    throw new Error(`Mesh ${segment} is empty`);
  }

  const view = new DataView(buffer);

  /*
   * Legacy Neuroglancer mesh format:
   *
   * uint32 vertex count
   * float32 xyz positions
   * uint32 triangle indices
   */

  const vertexCount = view.getUint32(0, true);

  const vertexStart = 4;

  const vertexBytes = vertexCount * 3 * 4;

  const indexStart = vertexStart + vertexBytes;

  if (indexStart > buffer.byteLength) {
    throw new Error(`Invalid vertex data in mesh ${segment}`);
  }

  const indexBytes = buffer.byteLength - indexStart;

  if (indexBytes % 4 !== 0) {
    throw new Error(`Invalid index data in mesh ${segment}`);
  }

  const vertices = new Float32Array(buffer.slice(vertexStart, indexStart));

  const indices = new Uint32Array(buffer.slice(indexStart, buffer.byteLength));

  console.log(`[Neuroglancer mesh] segment ${segment}:`, {
    vertexCount,
    triangleCount: indices.length / 3,
    bytes: buffer.byteLength,
  });

  return {
    vertices,
    indices,
  };
}

function createGeometry(data: MeshData) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data.vertices, 3),
  );

  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/* -------------------------------------------------- */
/* Anatomical material                                */
/* -------------------------------------------------- */

function AnatomicalMaterial() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,

      depthWrite: false,

      side: THREE.DoubleSide,

      blending: THREE.NormalBlending,

      uniforms: {
        surfaceColor: {
          value: new THREE.Color("#ffffff"),
        },

        edgeColor: {
          value: new THREE.Color("#eeeeee"),
        },

        opacity: {
          value: 0.05,
        },

        edgeOpacity: {
          value: 0.28,
        },

        edgeWidth: {
          value: 0.3,
        },
      },

      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {

          vec4 worldPosition =
            modelMatrix *
            vec4(position, 1.0);

          vWorldPosition =
            worldPosition.xyz;

          vNormal =
            normalize(
              mat3(modelMatrix) * normal
            );

          gl_Position =
            projectionMatrix *
            viewMatrix *
            worldPosition;
        }
      `,

      fragmentShader: `
        uniform vec3 surfaceColor;
        uniform vec3 edgeColor;

        uniform float opacity;
        uniform float edgeOpacity;
        uniform float edgeWidth;

        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {

          vec3 viewDirection =
            normalize(
              cameraPosition -
              vWorldPosition
            );

          float facing =
            abs(
              dot(
                normalize(vNormal),
                viewDirection
              )
            );

          /*
           * Surface facing camera:
           *
           * facing ≈ 1
           *
           * Surface perpendicular to camera:
           *
           * facing ≈ 0
           */

          float contour =
            1.0 -
            smoothstep(
              0.0,
              edgeWidth,
              facing
            );

          /*
           * Mostly transparent anatomical surface.
           */
          float alpha =
            opacity;

          /*
           * Grazing surfaces become dark.
           */
          vec3 color =
            mix(
              surfaceColor,
              edgeColor,
              contour
            );

          alpha =
            mix(
              alpha,
              edgeOpacity,
              contour
            );

          gl_FragColor =
            vec4(
              color,
              alpha
            );
        }
      `,
    });
  }, []);

  return <primitive object={material} attach="material" />;
}

/* -------------------------------------------------- */
/* Outer silhouette                                   */
/* -------------------------------------------------- */

function SilhouetteMaterial({ radius }: { radius: number }) {
  const material = useMemo(() => {
    const thickness = radius * 0.003;

    return new THREE.ShaderMaterial({
      transparent: true,

      depthWrite: false,

      side: THREE.BackSide,

      blending: THREE.NormalBlending,

      uniforms: {
        thickness: {
          value: thickness,
        },

        color: {
          value: new THREE.Color("#555555"),
        },

        opacity: {
          value: 0.25,
        },
      },

      vertexShader: `
        uniform float thickness;

        void main() {

          vec3 displaced =
            position +
            normal * thickness;

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(
              displaced,
              1.0
            );
        }
      `,

      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;

        void main() {

          gl_FragColor =
            vec4(
              color,
              opacity
            );
        }
      `,
    });
  }, [radius]);

  return <primitive object={material} attach="material" />;
}

/* -------------------------------------------------- */
/* Segment                                            */
/* -------------------------------------------------- */

function BrainSegment({ geometry }: { geometry: THREE.BufferGeometry }) {
  const radius = geometry.boundingSphere?.radius ?? 100;

  return (
    <>
      {/* Transparent anatomical shell */}
      <mesh geometry={geometry} renderOrder={1}>
        <AnatomicalMaterial />
      </mesh>

      {/* Dark outer contour */}
      <mesh geometry={geometry} renderOrder={2}>
        <SilhouetteMaterial radius={radius} />
      </mesh>
    </>
  );
}

/* -------------------------------------------------- */
/* Camera                                             */
/* -------------------------------------------------- */

function FitCamera({ geometries }: { geometries: THREE.BufferGeometry[] }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!geometries.length) {
      return;
    }

    const box = new THREE.Box3();

    for (const geometry of geometries) {
      geometry.computeBoundingBox();

      if (geometry.boundingBox) {
        box.union(geometry.boundingBox);
      }
    }

    const center = new THREE.Vector3();

    const size = new THREE.Vector3();

    box.getCenter(center);
    box.getSize(size);

    const radius = size.length() * 0.5;

    /*
     * Put camera in front of the CNS.
     *
     * We deliberately don't use the
     * Neuroglancer camera coordinates.
     */
    camera.position.set(center.x, center.y, center.z + radius * 2.2);

    camera.near = Math.max(radius / 10000, 0.01);

    camera.far = radius * 20;

    camera.updateProjectionMatrix();

    camera.lookAt(center);

    console.log("[Camera]", {
      center,
      size,
      radius,
      camera: camera.position.clone(),
    });
  }, [geometries, camera]);

  return null;
}

/* -------------------------------------------------- */
/* CNS                                                */
/* -------------------------------------------------- */

function CNS() {
  const [geometries, setGeometries] = useState<THREE.BufferGeometry[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        console.log("Loading Reiser CNS meshes...");

        /*
         * Reiser fullbrain-major-shells:
         *
         * 1 = CB
         * 2 = OL(L)
         * 3 = OL(R)
         */

        const data = await Promise.all([
          loadNgMesh("1"),
          loadNgMesh("2"),
          loadNgMesh("3"),
        ]);

        if (cancelled) {
          return;
        }

        const result = data.map(createGeometry);

        setGeometries(result);

        console.log("CNS meshes loaded:", result);

        setLoading(false);
      } catch (err) {
        console.error("CNS loading failed:", err);

        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));

          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return null;
  }

  if (error) {
    return null;
  }

  return (
    <>
      <group>
        {geometries.map((geometry, index) => (
          <BrainSegment key={index} geometry={geometry} />
        ))}
      </group>

      <FitCamera geometries={geometries} />
    </>
  );
}

/* -------------------------------------------------- */
/* Scene                                              */
/* -------------------------------------------------- */

function Scene() {
  return (
    <>
      <ambientLight intensity={1.5} />

      <directionalLight position={[1, 1, 1]} intensity={2} />

      <CNS />

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}

/* -------------------------------------------------- */
/* App                                                */
/* -------------------------------------------------- */

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#ffffff",
        position: "relative",
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 100],
          near: 0.01,
          far: 1_000_000,
        }}
        gl={{
          antialias: true,
          logarithmicDepthBuffer: true,
        }}
      >
        <Scene />
      </Canvas>

      {/* Loading / error UI is outside Canvas */}
      <CNSStatus />
    </div>
  );
}

/*
 * This independently checks the same assets so
 * failures are visible instead of giving a blank page.
 */
function CNSStatus() {
  const [status, setStatus] = useState("Loading CNS meshes...");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const results = await Promise.all(
          ["1", "2", "3"].map(async (segment) => {
            const url = `${BASE}%2Fmesh%2F${segment}%3A0?alt=media`;

            const response = await fetch(url);

            if (!response.ok) {
              throw new Error(`Segment ${segment}: HTTP ${response.status}`);
            }

            return segment;
          }),
        );

        if (!cancelled) {
          setStatus(`CNS loaded: segments ${results.join(", ")}`);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(
            `ERROR: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        padding: "8px 12px",
        background: "rgba(255,255,255,0.9)",
        border: "1px solid #cccccc",
        borderRadius: 6,
        fontFamily: "monospace",
        fontSize: 12,
        color: "#222",
        pointerEvents: "none",
      }}
    >
      {status}
    </div>
  );
}
