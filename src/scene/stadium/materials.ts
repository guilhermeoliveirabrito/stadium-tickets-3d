import type { Material } from 'three'
import { getNoiseTexture } from '../../lib/textures'

/** Variação sutil de tom em superfícies de concreto, baseada na posição no mundo. */
export function withSurfaceNoise<T extends Material>(material: T, key: string, strength = 0.18) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNoise = { value: getNoiseTexture() }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurfacePos;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vSurfacePos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurfacePos;\nuniform sampler2D uNoise;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 nUv = vSurfacePos.xz * 0.045 + vSurfacePos.y * 0.03;
        float n = texture2D(uNoise, nUv).g * 0.6 + texture2D(uNoise, nUv * 5.3).a * 0.4;
        diffuseColor.rgb *= 1.0 - ${strength.toFixed(3)} * 0.5 + n * ${strength.toFixed(3)};`,
      )
  }
  material.customProgramCacheKey = () => `surface-noise-${key}`
  return material
}
