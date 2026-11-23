import {
  AISLE_WIDTH,
  PARAPET_THICKNESS,
  SEAT,
  TIERS,
  type TierId,
  type TierSpec,
} from '../config/stadium'
import { frameAt, insetToS, SEGMENTS, segmentLength, type StandId } from './bowl'
import { mulberry32, valueNoise } from './random'

export interface Row {
  /** início do piso da fileira (d) */
  d: number
  y: number
  /** altura até a próxima fileira */
  rise: number
}

export interface TierGeometry {
  spec: TierSpec
  rows: Row[]
  /** d da parede de trás */
  back: number
  backTop: number
}

export interface Block {
  index: number
  tier: TierId
  level: number
  number: number
  stand: StandId
  segment: number
  /** posição dos eixos dos corredores que limitam o bloco (unidades de s) */
  s0: number
  s1: number
  seatStart: number
  seatCount: number
  available: number
  rows: number
  /** primeira linha deste bloco no mapa de cores das cadeiras */
  atlasRow: number
  /** por fileira: posição (u) do centro da 1ª cadeira, passo em u e quantidade */
  rowSeats: { uFirst: number; du: number; count: number; firstSeat: number }[]
}

export interface Seats {
  count: number
  position: Float32Array
  yaw: Float32Array
  block: Uint16Array
  row: Uint8Array
  number: Uint8Array
  taken: Uint8Array
}

export interface StadiumLayout {
  tiers: TierGeometry[]
  blocks: Block[]
  seats: Seats
}

export function tierGeometry(spec: TierSpec): TierGeometry {
  const rows: Row[] = []
  let y = spec.firstRow
  for (let i = 0; i < spec.rows; i++) {
    const t = spec.rows > 1 ? i / (spec.rows - 1) : 0
    const rise = spec.rise[0] + (spec.rise[1] - spec.rise[0]) * t
    rows.push({ d: spec.front + PARAPET_THICKNESS + i * spec.rowDepth, y, rise })
    y += rise
  }
  const last = rows[rows.length - 1]
  return {
    spec,
    rows,
    back: last.d + spec.rowDepth,
    backTop: spec.backTop ?? last.y + 1.2,
  }
}

function blocksInSegment(spec: TierSpec, segment: number) {
  const seg = SEGMENTS[segment]
  if (seg.kind === 'arc') return spec.blocks.corner
  return seg.long ? spec.blocks.long : spec.blocks.short
}

// O bloco central da arquibancada norte recebe o final 32 em todos os anéis
// (132, 232, 332) e a numeração segue no sentido horário.
const NORTH_CENTER = 3

export function buildLayout(): StadiumLayout {
  const tiers = TIERS.map(tierGeometry)
  const blocks: Block[] = []

  const position: number[] = []
  const yaw: number[] = []
  const blockOf: number[] = []
  const rowOf: number[] = []
  const numberOf: number[] = []
  const taken: number[] = []

  const frame = frameAt(SEGMENTS[0], 0, 0)
  const half = AISLE_WIDTH / 2 + SEAT.margin
  let atlasRows = 0

  for (const tier of tiers) {
    const { spec } = tier
    const total = SEGMENTS.reduce((n, _, i) => n + blocksInSegment(spec, i), 0)
    let local = 0

    SEGMENTS.forEach((seg, segment) => {
      const n = blocksInSegment(spec, segment)
      for (let b = 0; b < n; b++) {
        const index = blocks.length
        const s0 = b / n
        const s1 = (b + 1) / n
        const number = spec.level * 100 + ((local - NORTH_CENTER + 31 + total) % total) + 1
        const rand = mulberry32(number * 7919)
        // procura maior no centro das laterais e no anel intermediário
        const centrality = seg.kind === 'line' ? 1 - Math.abs((s0 + s1) / 2 - 0.5) * 1.6 : 0.25
        const demand = 0.62 + centrality * 0.1 + (spec.level === 2 ? 0.03 : 0) + (rand() - 0.5) * 0.08

        const block: Block = {
          index,
          tier: spec.id,
          level: spec.level,
          number,
          stand: seg.stand,
          segment,
          s0,
          s1,
          seatStart: yaw.length,
          seatCount: 0,
          available: 0,
          rows: spec.rows,
          atlasRow: atlasRows,
          rowSeats: [],
        }
        atlasRows += spec.rows

        tier.rows.forEach((row, r) => {
          const d = row.d + spec.rowDepth - SEAT.setback
          const a = s0 + insetToS(seg, half, d)
          const z = s1 - insetToS(seg, half, d)
          const len = (z - a) * segmentLength(seg, d)
          const count = Math.max(0, Math.floor((len - SEAT.width) / SEAT.pitch) + 1)
          const used = (count - 1) * SEAT.pitch
          const ds = SEAT.pitch / segmentLength(seg, d)
          const start = a + (z - a) / 2 - (used / 2) / segmentLength(seg, d)
          // u vai de 0 a 1 ao longo do degrau, de corredor a corredor (como na geometria)
          const u0 = s0 + insetToS(seg, AISLE_WIDTH / 2, d)
          const u1 = s1 - insetToS(seg, AISLE_WIDTH / 2, d)
          block.rowSeats.push({ uFirst: (start - u0) / (u1 - u0), du: ds / (u1 - u0), count, firstSeat: yaw.length })

          for (let k = 0; k < count; k++) {
            frameAt(seg, start + k * ds, d, frame)
            position.push(frame.x, row.y, frame.z)
            yaw.push(Math.atan2(-frame.nx, -frame.nz))
            blockOf.push(index)
            rowOf.push(r + 1)
            numberOf.push(k + 1)
            const cluster = valueNoise(k * 0.32, r * 0.55, number)
            const isTaken = cluster * 0.7 + rand() * 0.3 < demand
            taken.push(isTaken ? 1 : 0)
            if (!isTaken) block.available++
          }
          block.seatCount += count
        })

        blocks.push(block)
        local++
      }
    })
  }

  return {
    tiers,
    blocks,
    seats: {
      count: yaw.length,
      position: new Float32Array(position),
      yaw: new Float32Array(yaw),
      block: new Uint16Array(blockOf),
      row: new Uint8Array(rowOf),
      number: new Uint8Array(numberOf),
      taken: new Uint8Array(taken),
    },
  }
}

let cached: StadiumLayout | null = null
export function getLayout() {
  if (!cached) cached = buildLayout()
  return cached
}
