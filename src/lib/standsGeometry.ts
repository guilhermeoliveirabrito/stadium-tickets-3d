import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute } from 'three'
import { AISLE_WIDTH, BACK_WALL_THICKNESS, PARAPET_THICKNESS } from '../config/stadium'
import { frameAt, insetToS, SEGMENTS, type Segment } from './bowl'
import type { StadiumLayout, TierGeometry } from './layout'

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
  tread: '#9e9a92',
  riser: '#7f7b74',
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

class Builder {
  position: number[] = []
  normal: number[] = []
  color: number[] = []
  block: number[] = []
  index: number[] = []
  private frame = frameAt(SEGMENTS[0], 0, 0)

  /**
   * Varre o perfil ao longo do segmento. `range(d)` devolve o intervalo [s0, s1]
   * ocupado na curva de distância d.
   */
  sweep(
    profile: P[],
    seg: Segment,
    range: (d: number) => [number, number],
    samples: number,
    blockIndex: number,
    palette: Record<Kind, Color>,
  ) {
    const f = this.frame
    for (let e = 0; e < profile.length; e++) {
      const a = profile[e]
      const b = profile[(e + 1) % profile.length]
      const ed = b.d - a.d
      const ey = b.y - a.y
      const len = Math.hypot(ed, ey)
      if (len < 1e-5) continue
      const nd = -ey / len
      const ny = ed / len
      const c = palette[a.kind]
      const base = this.position.length / 3

      for (let k = 0; k <= samples; k++) {
        for (const p of [a, b]) {
          const [s0, s1] = range(p.d)
          frameAt(seg, s0 + ((s1 - s0) * k) / samples, p.d, f)
          this.position.push(f.x, p.y, f.z)
          this.normal.push(f.nx * nd, ny, f.nz * nd)
          this.color.push(c.r, c.g, c.b)
          this.block.push(blockIndex)
        }
      }
      for (let k = 0; k < samples; k++) {
        const i = base + k * 2
        this.index.push(i, i + 3, i + 1, i, i + 2, i + 3)
      }
    }
  }

  build() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.position, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.normal, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.color, 3))
    g.setAttribute('aBlock', new Float32BufferAttribute(this.block, 1))
    g.setIndex(new Uint32BufferAttribute(this.index, 1))
    g.computeBoundingSphere()
    return g
  }
}

const ARC_STEP = (2.5 * Math.PI) / 180

function samplesFor(seg: Segment, span: number) {
  if (seg.kind === 'line') return 1
  return Math.max(1, Math.ceil((span * seg.sweep) / ARC_STEP))
}

export function buildStandsGeometry(layout: StadiumLayout) {
  const builder = new Builder()
  const half = AISLE_WIDTH / 2

  for (const tier of layout.tiers) {
    const palette = Object.fromEntries(
      Object.entries({ ...COLORS, fascia: tier.spec.fascia }).map(([k, v]) => [k, new Color(v)]),
    ) as Record<Kind, Color>
    const seatsProfile = tierProfile(tier, false)
    const aisleProfile = tierProfile(tier, true)

    for (const block of layout.blocks) {
      if (block.tier !== tier.spec.id) continue
      const seg = SEGMENTS[block.segment]
      const { s0, s1 } = block
      builder.sweep(
        seatsProfile,
        seg,
        (d) => [s0 + insetToS(seg, half, d), s1 - insetToS(seg, half, d)],
        samplesFor(seg, s1 - s0),
        block.index,
        palette,
      )
      // corredor no início do bloco (metade em cada segmento nas junções)
      const startsSegment = s0 === 0
      builder.sweep(
        aisleProfile,
        seg,
        (d) => [startsSegment ? s0 : s0 - insetToS(seg, half, d), s0 + insetToS(seg, half, d)],
        1,
        -1,
        palette,
      )
      if (s1 === 1) {
        builder.sweep(aisleProfile, seg, (d) => [s1 - insetToS(seg, half, d), s1], 1, -1, palette)
      }
    }
  }
  return builder.build()
}
