import type { Material, Texture, WebGLProgramParametersWithUniforms } from 'three'
import { getCity, HALF, WORLD } from '../../lib/city/layout'
import { canvasTexture } from '../../lib/textures'
import { drawLightMap } from './groundTexture'

let lightMap: Texture | null = null

/** Mapa de luz do chão (postes, casas, neon), compartilhado entre os materiais da cidade. */
export function getCityLightMap() {
  if (!lightMap) {
    const city = getCity()
    lightMap = canvasTexture(2048, 2048, (ctx, size) => drawLightMap(ctx, size, city), { anisotropy: 4 })
    lightMap.channel = 0
  }
  return lightMap
}

interface CityLightOptions {
  /** intensidade da luz recebida */
  strength?: number
  /** altura (m) em que a luz cai pela metade */
  falloff?: number
}

/**
 * Faz o objeto receber a luz dos postes: lê o mapa de luz do chão na posição
 * do fragmento e soma como luz indireta, mais forte perto do chão e nas faces
 * voltadas para cima.
 */
export function addCityLight(shader: WebGLProgramParametersWithUniforms, options: CityLightOptions = {}) {
  const { strength = 2, falloff = 5 } = options
  shader.uniforms.uCityLight = { value: getCityLightMap() }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCityPos;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 cityWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cityWorld = instanceMatrix * cityWorld;
      #endif
      vCityPos = (modelMatrix * cityWorld).xyz;`,
    )
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCityPos;\nuniform sampler2D uCityLight;')
    .replace(
      '#include <lights_fragment_maps>',
      `#include <lights_fragment_maps>
      {
        vec2 cityUv = vec2((vCityPos.x + ${HALF.toFixed(1)}) / ${WORLD.toFixed(1)}, 1.0 - (vCityPos.z + ${HALF.toFixed(1)}) / ${WORLD.toFixed(1)});
        vec3 cityLight = texture2D(uCityLight, cityUv).rgb;
        float lift = exp2(-max(vCityPos.y, 0.0) / ${falloff.toFixed(2)});
        float facing = 0.55 + 0.45 * clamp(normal.y, 0.0, 1.0);
        irradiance += cityLight * ${strength.toFixed(2)} * lift * facing;
      }`,
    )
}

export function withCityLight<T extends Material>(material: T, key: string, options?: CityLightOptions) {
  material.onBeforeCompile = (shader) => addCityLight(shader, options)
  material.customProgramCacheKey = () => `city-light-${key}`
  return material
}
