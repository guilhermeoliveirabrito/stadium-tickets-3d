import type { Material, Texture } from 'three'
import { pixelUniforms } from '../pixelScale'
import { getNoiseTexture } from '../../lib/textures'
import { FLASH_HEADER, flashTerm, flashUniforms, floodTerm } from '../lighting'

interface Options {
  strength?: number
  /** soma o atributo aEmissive (faixas de LED geradas no perfil) */
  vertexEmissive?: boolean
  /** luz dos refletores e rebatida dentro do estádio (só para este material) */
  fill?: number
  /** mapa com a cor de cada cadeira (uma linha por fileira), pintado nos degraus de longe */
  seatMap?: { texture: Texture; width: number; height: number }
}

/**
 * De longe as cadeiras 3D somem (encolhem até virar um ponto) e o degrau
 * embaixo delas passa a mostrar a cor de cada uma, lida de um mapa filtrado
 * pela placa de vídeo. Desenhar 60 mil cadeiras de ~1 pixel era a parte mais
 * cara da cena, e o mapa também é mais estável quando a câmera se move.
 * A troca acontece entre 3 e 2 pixels por cadeira, igual nos dois lados.
 */
function seatMapChunk(map: NonNullable<Options['seatMap']>) {
  return /* glsl */ `
  {
    float seatOn = step(0.0, vSeatRow.x);
    float seatPx = 0.44 / max(length(vViewPosition) * uPixelAngle, 1e-6);
    float seatFar = (1.0 - smoothstep(2.0, 3.0, seatPx)) * seatOn;
    float k = (vSeatU - vSeatRow.y) / max(vSeatRow.z, 1e-5);
    // perto: só onde há cadeira; longe: o degrau inteiro, até o corredor
    float inside = mix(step(-0.5, k) * step(k, vSeatRow.w - 0.5), 1.0, seatFar);
    vec2 seatUv = vec2(
      (clamp(k, 0.0, max(vSeatRow.w - 1.0, 0.0)) + 0.5) / ${map.width.toFixed(1)},
      (max(vSeatRow.x, 0.0) + 0.5) / ${map.height.toFixed(1)}
    );
    vec3 seatColor = texture2D(uSeatMap, seatUv).rgb;
    diffuseColor.rgb = mix(diffuseColor.rgb, seatColor, seatFar * inside);
  }`
}

export function withLocalFill<T extends Material>(material: T, key: string, fill: number) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, flashUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFillWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 fillWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fillWorld = instanceMatrix * fillWorld;
        #endif
        vFillWorld = (modelMatrix * fillWorld).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFillWorld;\n${FLASH_HEADER}`)
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        ${floodTerm(fill)}
        ${flashTerm('vFillWorld')}`,
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
    seatMap,
  } = typeof options === 'number' ? { strength: options } : options
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNoise = { value: getNoiseTexture() }
    Object.assign(shader.uniforms, flashUniforms)
    if (seatMap) Object.assign(shader.uniforms, pixelUniforms, { uSeatMap: { value: seatMap.texture } })
    const seatVaryings = seatMap ? 'varying vec4 vSeatRow;\nvarying float vSeatU;' : ''
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSurfacePos;
        ${vertexEmissive ? 'attribute vec3 aEmissive;\nvarying vec3 vEmissive;' : ''}
        ${seatMap ? `attribute vec4 aSeatRow;\nattribute float aSeatU;\n${seatVaryings}` : ''}`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vSurfacePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        ${vertexEmissive ? 'vEmissive = aEmissive;' : ''}
        ${seatMap ? 'vSeatRow = aSeatRow;\nvSeatU = aSeatU;' : ''}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSurfacePos;
        uniform sampler2D uNoise;
        ${FLASH_HEADER}
        ${vertexEmissive ? 'varying vec3 vEmissive;' : ''}
        ${seatMap ? `uniform sampler2D uSeatMap;\nuniform float uPixelAngle;\n${seatVaryings}` : ''}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 nUv = vSurfacePos.xz * 0.045 + vSurfacePos.y * 0.03;
        float n = texture2D(uNoise, nUv).g * 0.6 + texture2D(uNoise, nUv * 5.3).a * 0.4;
        diffuseColor.rgb *= 1.0 - ${strength.toFixed(3)} * 0.5 + n * ${strength.toFixed(3)};
        ${seatMap ? seatMapChunk(seatMap) : ''}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        ${vertexEmissive ? 'totalEmissiveRadiance += vEmissive;' : ''}`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        ${floodTerm(fill)}
        ${flashTerm('vSurfacePos')}`,
      )
  }
  material.customProgramCacheKey = () => `surface-noise-${key}`
  return material
}
