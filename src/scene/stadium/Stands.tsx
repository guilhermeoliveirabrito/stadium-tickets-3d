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

const getStandsParts = once(() => {
  const layout = getLayout()
  return {
    geometry: buildStandsGeometry(layout),
    material: withSurfaceNoise(new MeshLambertMaterial({ vertexColors: true }), 'stands', {
      vertexEmissive: true,
      fill: 1.15,
      seatMap: createSeatMap(layout),
    }),
  }
})

export function Stands() {
  const { geometry, material } = useMemo(() => getStandsParts(), [])
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}
