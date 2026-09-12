import { useMemo } from "react";
import * as THREE from "three";

interface SilhouetteMaterialProps {
  readonly radius: number;
}

export function SilhouetteMaterial({ radius }: SilhouetteMaterialProps) {
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
            vec4(displaced, 1.0);
        }
      `,

      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;

        void main() {
          gl_FragColor =
            vec4(color, opacity);
        }
      `,
    });
  }, [radius]);

  return <primitive object={material} attach="material" />;
}
