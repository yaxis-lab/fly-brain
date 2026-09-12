import { useMemo } from "react";
import * as THREE from "three";

export function AnatomicalMaterial() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
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
              modelMatrix * vec4(position, 1.0);

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

            float contour =
              1.0 -
              smoothstep(
                0.0,
                edgeWidth,
                facing
              );

            vec3 color =
              mix(
                surfaceColor,
                edgeColor,
                contour
              );

            float alpha =
              mix(
                opacity,
                edgeOpacity,
                contour
              );

            gl_FragColor =
              vec4(color, alpha);
          }
        `,
      }),
    [],
  );

  return <primitive object={material} attach="material" />;
}
