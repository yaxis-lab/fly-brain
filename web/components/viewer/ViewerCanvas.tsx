import { Canvas } from "@react-three/fiber";

import type { CNSMesh } from "@/types/cns";
import { CNSScene } from "../cns/CNSScene";

interface ViewerCanvasProps {
  readonly meshes: readonly CNSMesh[];
}

export function ViewerCanvas({ meshes }: ViewerCanvasProps) {
  return (
    <Canvas
      camera={{
        position: [0, 0, 1000],
        near: 0.1,
        far: 10_000_000,
      }}
      gl={{
        antialias: true,
        logarithmicDepthBuffer: true,
      }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[1, 1, 1]} intensity={2} />

      <CNSScene meshes={meshes} />
    </Canvas>
  );
}
