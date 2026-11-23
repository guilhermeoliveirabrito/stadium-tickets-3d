import { useMemo } from 'react'
import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { getLayout, type StadiumLayout } from '../../lib/layout'
import { once } from '../../lib/once'
import { getSeatColors } from '../../lib/seatColors'
import { buildStandsGeometry } from '../../lib/standsGeometry'
import { extendShader } from '../pixelScale'
import { HIGHLIGHT_LINEAR, SELECTION_FUNCTIONS, SELECTION_HEADER, selectionUniforms } from '../selection'
import { withSurfaceNoise } from './materials'

const SEAT_MAP_WIDTH = 32

/** Uma linha por fileira de cada bloco, uma coluna por cadeira (sRGB, com mipmaps). */
function createSeatMap(layout: StadiumLayout) {
  const height = layout.blocks.reduce((n, b) => n + b.rows, 0)
  const data = new Uint8Array(SEAT_MAP_WIDTH * height * 4)
  const colors = getSeatColors(layout.seats)
  const color = new Color()
  for (const block of layout.blocks) {
    block.rowSeats.forEach((row, r) => {
      const y = block.atlasRow + r
      for (let k = 0; k < SEAT_MAP_WIDTH; k++) {
        // depois da última cadeira repete a cor dela, para o filtro não puxar preto
        const seat = row.firstSeat + Math.min(k, Math.max(0, row.count - 1))
        color.fromArray(colors, seat * 3).convertLinearToSRGB()
        const i = (y * SEAT_MAP_WIDTH + k) * 4
        data[i] = Math.round(color.r * 255)
        data[i + 1] = Math.round(color.g * 255)
        data[i + 2] = Math.round(color.b * 255)
        data[i + 3] = 255
      }
    })
  }
  const texture = new DataTexture(data, SEAT_MAP_WIDTH, height, RGBAFormat, UnsignedByteType)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return { texture, width: SEAT_MAP_WIDTH, height }
}

/**
 * Bloco sob o cursor ou escolhido em laranja; na vista de frente, os outros
 * blocos escurecem. Entra antes da iluminação, depois de toda a cor.
 * (O painel de LED na frente do bloco acende em LedRibbons.)
 */
const BLOCK_HIGHLIGHT = /* glsl */ `
{
  float picked = selIs(vBlockId, uSelectBlock);
  float hl = max(selIs(vBlockId, uHoverBlock) * 0.85, picked);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${HIGHLIGHT_LINEAR} * 0.9, hl * 0.72);
  totalEmissiveRadiance += ${HIGHLIGHT_LINEAR} * hl * (0.2 + 0.16 * uPulse * picked);
  float dim = step(0.0, uFocusBlock) * (1.0 - selIs(vBlockId, uFocusBlock));
  diffuseColor.rgb *= 1.0 - dim * 0.55;
}
`

const getStandsParts = once(() => {
  const layout = getLayout()
  const material = withSurfaceNoise(new MeshLambertMaterial({ vertexColors: true }), 'stands', {
    fill: 1.15,
    seatMap: createSeatMap(layout),
  })
  extendShader(material, 'block-highlight', (shader) => {
    Object.assign(shader.uniforms, selectionUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBlock;\nvarying float vBlockId;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlockId = aBlock;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vBlockId;\n${SELECTION_HEADER}\n${SELECTION_FUNCTIONS}`)
      .replace('#include <lights_lambert_fragment>', `${BLOCK_HIGHLIGHT}\n#include <lights_lambert_fragment>`)
  })
  return { geometry: buildStandsGeometry(layout), material }
})

export function Stands() {
  const { geometry, material } = useMemo(() => getStandsParts(), [])
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}
