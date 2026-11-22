import type { Material } from 'three'
import { getNoiseTexture } from '../../lib/textures'

interface Options {
  strength?: number
  /** soma o atributo aEmissive (faixas de LED geradas no perfil) */
  vertexEmissive?: boolean
  /** luz rebatida dentro do estádio (só para este material) */
  fill?: number
}

/**
 * Simula a luz que o gramado e as arquibancadas rebatem durante um jogo
 * noturno. Funciona como uma luz ambiente aplicada só aos materiais do
 * estádio, sem clarear a cidade em volta.
 */
export const STADIUM_FILL = '0.62, 0.64, 0.72'

function fillChunk(fill: number) {
  return fill > 0 ? `irradiance += vec3(${STADIUM_FILL}) * ${fill.toFixed(3)};` : ''
}

export function withLocalFill<T extends Material>(material: T, key: string, fill: number) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_maps>',
      `#include <lights_fragment_maps>
      ${fillChunk(fill)}`,
    )
  }
  material.customProgramCacheKey = () => `fill-${key}`
  return material
}

/** Variação sutil de tom em superfícies de concreto, baseada na posição no mundo. */
export function withSurfaceNoise<T extends Material>(material: T, key: string, options: Options | number = {}) {
  const {
    strength = 0.18,
    vertexEmissive = false,
    fill = 0,
  } = typeof options === 'number' ? { strength: options } : options
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNoise = { value: getNoiseTexture() }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSurfacePos;
        ${vertexEmissive ? 'attribute vec3 aEmissive;\nvarying vec3 vEmissive;' : ''}`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vSurfacePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        ${vertexEmissive ? 'vEmissive = aEmissive;' : ''}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSurfacePos;
        uniform sampler2D uNoise;
        ${vertexEmissive ? 'varying vec3 vEmissive;' : ''}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 nUv = vSurfacePos.xz * 0.045 + vSurfacePos.y * 0.03;
        float n = texture2D(uNoise, nUv).g * 0.6 + texture2D(uNoise, nUv * 5.3).a * 0.4;
        diffuseColor.rgb *= 1.0 - ${strength.toFixed(3)} * 0.5 + n * ${strength.toFixed(3)};`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        ${vertexEmissive ? 'totalEmissiveRadiance += vEmissive;' : ''}`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        ${fillChunk(fill)}`,
      )
  }
  material.customProgramCacheKey = () => `surface-noise-${key}`
  return material
}
