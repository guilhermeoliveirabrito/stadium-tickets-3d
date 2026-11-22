import { Color } from 'three'
import { AISLE_WIDTH, BACK_WALL_THICKNESS, PARAPET_THICKNESS, SEAT_COLORS } from '../config/stadium'
import { insetToS, SEGMENTS } from './bowl'
import type { StadiumLayout, TierGeometry } from './layout'
import { arcSamples, SweepBuilder, type ProfilePoint } from './sweep'

type Kind =
  | 'fascia'
  | 'cap'
  | 'inner'
  | 'tread'
  | 'riser'
  | 'step'
  | 'stepRiser'
  | 'back'
  | 'backCap'
  | 'backOuter'
  | 'under'

interface P {
  d: number
  y: number
  /** tipo da aresta que sai deste ponto */
  kind: Kind
}

const COLORS: Record<Exclude<Kind, 'fascia'>, string> = {
  cap: '#d7d3cc',
  inner: '#8e8a83',
  // substituídos, bloco a bloco, por um tom escuro da cor média das cadeiras
  tread: '#4f4c48',
  riser: '#45423e',
  step: '#e4e1db',
  stepRiser: '#c3bfb8',
  back: '#34373d',
  backCap: '#cfcac2',
  backOuter: '#8a867f',
  under: '#bdb8af',
}

/** Perfil fechado da arquibancada, em sentido horário no plano (d, y). */
function tierProfile(tier: TierGeometry, aisle: boolean): P[] {
  const { spec, rows, back, backTop } = tier
  const top = spec.firstRow + spec.parapet
  const pts: P[] = [
    { d: spec.front, y: spec.under, kind: 'fascia' },
    { d: spec.front, y: top, kind: 'cap' },
    { d: spec.front + PARAPET_THICKNESS, y: top, kind: 'inner' },
  ]
  rows.forEach((row, i) => {
    const last = i === rows.length - 1
    const depth = spec.rowDepth
    if (!aisle) {
      pts.push({ d: row.d, y: row.y, kind: 'tread' })
      pts.push({ d: row.d + depth, y: row.y, kind: last ? 'back' : 'riser' })
      return
    }
    pts.push({ d: row.d, y: row.y, kind: 'step' })
    if (last) {
      pts.push({ d: row.d + depth, y: row.y, kind: 'back' })
    } else {
      pts.push({ d: row.d + depth / 2, y: row.y, kind: 'stepRiser' })
      pts.push({ d: row.d + depth / 2, y: row.y + row.rise / 2, kind: 'step' })
      pts.push({ d: row.d + depth, y: row.y + row.rise / 2, kind: 'stepRiser' })
    }
  })
  pts.push({ d: back, y: backTop, kind: 'backCap' })
  pts.push({ d: back + BACK_WALL_THICKNESS, y: backTop, kind: 'backOuter' })
  pts.push({ d: back + BACK_WALL_THICKNESS, y: spec.backBottom, kind: 'under' })
  for (const [d, y] of spec.underside) pts.push({ d, y, kind: 'under' })
  return pts
}

// faixa de LED nas bordas dos anéis superiores
const RIBBON = new Color('#1a2cff').multiplyScalar(1.1)

const TAKEN = new Color(SEAT_COLORS.taken)
const AVAILABLE = new Color(SEAT_COLORS.available)

function colored(points: P[], palette: Record<Kind, Color>, ribbon: boolean): ProfilePoint[] {
  return points.map((p) => ({
    d: p.d,
    y: p.y,
    color: palette[p.kind],
    emissive: ribbon && p.kind === 'fascia' ? RIBBON : undefined,
  }))
}

export function buildStandsGeometry(layout: StadiumLayout) {
  const builder = new SweepBuilder()
  const half = AISLE_WIDTH / 2

  for (const tier of layout.tiers) {
    const palette = Object.fromEntries(
      Object.entries({ ...COLORS, fascia: tier.spec.fascia }).map(([k, v]) => [k, new Color(v)]),
    ) as Record<Kind, Color>
    const ribbon = tier.spec.level > 1
    const seatsShape = tierProfile(tier, false)
    const aisleProfile = colored(tierProfile(tier, true), palette, ribbon)

    for (const block of layout.blocks) {
      if (block.tier !== tier.spec.id) continue
      const seg = SEGMENTS[block.segment]
      const { s0, s1 } = block
      // O piso e o espelho dos degraus sob as cadeiras levam um tom escuro da
      // cor média das cadeiras do bloco. De longe, as frestas entre cadeiras e
      // fileiras (menores que um pixel) somem no meio delas em vez de virarem
      // pontos e listras pretas que piscam com o movimento da câmera.
      const average = TAKEN.clone().lerp(AVAILABLE, block.available / Math.max(1, block.seatCount))
      const seatsProfile = colored(
        seatsShape,
        { ...palette, tread: average.clone().multiplyScalar(0.5), riser: average.clone().multiplyScalar(0.4) },
        ribbon,
      )
      builder.sweep(
        seatsProfile,
        seg,
        (d) => [s0 + insetToS(seg, half, d), s1 - insetToS(seg, half, d)],
        arcSamples(seg, s1 - s0),
        block.index,
      )
      // corredor no início do bloco (metade em cada segmento nas junções)
      const startsSegment = s0 === 0
      builder.sweep(
        aisleProfile,
        seg,
        (d) => [startsSegment ? s0 : s0 - insetToS(seg, half, d), s0 + insetToS(seg, half, d)],
        1,
      )
      if (s1 === 1) {
        builder.sweep(aisleProfile, seg, (d) => [s1 - insetToS(seg, half, d), s1], 1)
      }
    }
  }
  return builder.build()
}
