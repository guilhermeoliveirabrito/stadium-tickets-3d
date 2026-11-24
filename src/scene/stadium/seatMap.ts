import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { getLayout, type StadiumLayout } from '../../lib/layout'
import { once } from '../../lib/once'
import { getSeatColors } from '../../lib/seatColors'

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

export const getSeatMap = once(() => createSeatMap(getLayout()))

/**
 * Troca a cor de uma cadeira no mapa usado de longe (ingresso comprado). Se
 * for a última da fileira, repete a cor no resto da linha, como na criação.
 */
export function paintSeatMapSeat(seat: number, color: Color) {
  const { seats, blocks } = getLayout()
  const map = getSeatMap()
  const block = blocks[seats.block[seat]]
  const r = seats.row[seat] - 1
  const row = block.rowSeats[r]
  const k = seat - row.firstSeat
  if (!row || k < 0 || k >= map.width) return
  const srgb = color.clone().convertLinearToSRGB()
  const data = map.texture.image.data as Uint8Array
  const y = block.atlasRow + r
  const end = k === row.count - 1 ? map.width : k + 1
  for (let x = k; x < end; x++) {
    const i = (y * map.width + x) * 4
    data[i] = Math.round(srgb.r * 255)
    data[i + 1] = Math.round(srgb.g * 255)
    data[i + 2] = Math.round(srgb.b * 255)
  }
  map.texture.needsUpdate = true
}

