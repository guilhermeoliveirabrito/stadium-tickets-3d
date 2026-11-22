import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute } from 'three'
import { frameAt, SEGMENTS, segmentLength, type Frame, type Segment } from './bowl'

export interface ProfilePoint {
  d: number
  y: number
  /** cor da aresta que sai deste ponto */
  color: Color
  /** emissão da aresta (faixas de LED); preto quando omitida */
  emissive?: Color
}

const ARC_STEP = (2.5 * Math.PI) / 180

export function arcSamples(seg: Segment, span = 1) {
  if (seg.kind === 'line') return 1
  return Math.max(1, Math.ceil((span * seg.sweep) / ARC_STEP))
}

/**
 * Gera superfícies varrendo um perfil 2D (d, y) ao longo do contorno do estádio.
 * O perfil deve estar em sentido horário para as normais apontarem para fora.
 */
export class SweepBuilder {
  private position: number[] = []
  private normal: number[] = []
  private color: number[] = []
  private emissive: number[] = []
  private block: number[] = []
  private index: number[] = []
  private frame = frameAt(SEGMENTS[0], 0, 0)

  sweep(
    profile: ProfilePoint[],
    seg: Segment,
    range: (d: number) => [number, number] = () => [0, 1],
    samples = arcSamples(seg),
    blockIndex = -1,
    closed = true,
  ) {
    const f = this.frame
    const edges = closed ? profile.length : profile.length - 1
    for (let e = 0; e < edges; e++) {
      const a = profile[e]
      const b = profile[(e + 1) % profile.length]
      const ed = b.d - a.d
      const ey = b.y - a.y
      const len = Math.hypot(ed, ey)
      if (len < 1e-5) continue
      const nd = -ey / len
      const ny = ed / len
      const base = this.position.length / 3

      for (let k = 0; k <= samples; k++) {
        for (const p of [a, b]) {
          const [s0, s1] = range(p.d)
          frameAt(seg, s0 + ((s1 - s0) * k) / samples, p.d, f)
          this.position.push(f.x, p.y, f.z)
          this.normal.push(f.nx * nd, ny, f.nz * nd)
          this.color.push(a.color.r, a.color.g, a.color.b)
          if (a.emissive) this.emissive.push(a.emissive.r, a.emissive.g, a.emissive.b)
          else this.emissive.push(0, 0, 0)
          this.block.push(blockIndex)
        }
      }
      for (let k = 0; k < samples; k++) {
        const i = base + k * 2
        this.index.push(i, i + 3, i + 1, i, i + 2, i + 3)
      }
    }
    return this
  }

  /** Varre o perfil pelo contorno inteiro (ou pelos segmentos indicados). */
  around(profile: ProfilePoint[], segments: number[] = SEGMENTS.map((_, i) => i), closed = true) {
    for (const i of segments) this.sweep(profile, SEGMENTS[i], undefined, arcSamples(SEGMENTS[i]), -1, closed)
    return this
  }

  build() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.position, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.normal, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.color, 3))
    g.setAttribute('aEmissive', new Float32BufferAttribute(this.emissive, 3))
    g.setAttribute('aBlock', new Float32BufferAttribute(this.block, 1))
    g.setIndex(new Uint32BufferAttribute(this.index, 1))
    g.computeBoundingSphere()
    return g
  }
}

/** Atalho para montar perfis: [d, y, cor, emissão?][] */
export function profile(points: [number, number, string, Color?][]): ProfilePoint[] {
  const cache = new Map<string, Color>()
  return points.map(([d, y, hex, emissive]) => {
    if (!cache.has(hex)) cache.set(hex, new Color(hex))
    return { d, y, color: cache.get(hex)!, emissive }
  })
}

/** Pontos igualmente espaçados ao longo da curva de distância d. */
export function pointsAlong(d: number, spacing: number, segments: number[] = SEGMENTS.map((_, i) => i)) {
  const out: (Frame & { segment: number })[] = []
  for (const i of segments) {
    const seg = SEGMENTS[i]
    const count = Math.max(1, Math.round(segmentLength(seg, d) / spacing))
    for (let k = 0; k < count; k++) {
      out.push({ ...frameAt(seg, (k + 0.5) / count, d), segment: i })
    }
  }
  return out
}
