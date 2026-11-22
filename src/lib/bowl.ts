import { BOWL } from '../config/stadium'

export type StandId = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

interface LineSegment {
  kind: 'line'
  stand: StandId
  long: boolean
  ox: number
  oz: number
  tx: number
  tz: number
  nx: number
  nz: number
  length: number
}

interface ArcSegment {
  kind: 'arc'
  stand: StandId
  cx: number
  cz: number
  from: number
  sweep: number
}

export type Segment = LineSegment | ArcSegment

export interface Frame {
  x: number
  z: number
  /** normal para fora do estádio */
  nx: number
  nz: number
  /** tangente no sentido horário (visto de cima) */
  tx: number
  tz: number
}

const sx = BOWL.halfX - BOWL.radius
const sz = BOWL.halfZ - BOWL.radius
const R = BOWL.radius
const H = Math.PI / 2

const line = (stand: StandId, long: boolean, ox: number, oz: number, tx: number, tz: number, length: number): LineSegment => ({
  kind: 'line',
  stand,
  long,
  ox,
  oz,
  tx,
  tz,
  nx: tz,
  nz: -tx,
  length,
})

const arc = (stand: StandId, cx: number, cz: number, from: number): ArcSegment => ({
  kind: 'arc',
  stand,
  cx,
  cz,
  from,
  sweep: H,
})

/** Contorno no sentido horário, começando pela ponta oeste da lateral norte. */
export const SEGMENTS: Segment[] = [
  line('N', true, -sx, -BOWL.halfZ, 1, 0, 2 * sx),
  arc('NE', sx, -sz, -H),
  line('E', false, BOWL.halfX, -sz, 0, 1, 2 * sz),
  arc('SE', sx, sz, 0),
  line('S', true, sx, BOWL.halfZ, -1, 0, 2 * sx),
  arc('SW', -sx, sz, H),
  line('W', false, -BOWL.halfX, sz, 0, -1, 2 * sz),
  arc('NW', -sx, -sz, Math.PI),
]

export function frameAt(seg: Segment, s: number, d: number, out: Frame = { x: 0, z: 0, nx: 0, nz: 0, tx: 0, tz: 0 }) {
  if (seg.kind === 'line') {
    out.nx = seg.nx
    out.nz = seg.nz
    out.tx = seg.tx
    out.tz = seg.tz
    out.x = seg.ox + seg.tx * s * seg.length + seg.nx * d
    out.z = seg.oz + seg.tz * s * seg.length + seg.nz * d
  } else {
    const a = seg.from + s * seg.sweep
    const c = Math.cos(a)
    const n = Math.sin(a)
    out.nx = c
    out.nz = n
    out.tx = -n
    out.tz = c
    out.x = seg.cx + (R + d) * c
    out.z = seg.cz + (R + d) * n
  }
  return out
}

/** Comprimento do segmento na curva paralela de distância d. */
export function segmentLength(seg: Segment, d: number) {
  return seg.kind === 'line' ? seg.length : (R + d) * seg.sweep
}

/**
 * Converte um recuo lateral (em metros, medido perpendicularmente ao eixo de
 * um corredor) para unidades de s na curva de distância d.
 */
export function insetToS(seg: Segment, inset: number, d: number) {
  if (seg.kind === 'line') return inset / seg.length
  const r = R + d
  return Math.asin(Math.min(1, inset / r)) / seg.sweep
}

export const STAND_NAMES: Record<StandId, string> = {
  N: 'Norte',
  NE: 'Nordeste',
  E: 'Leste',
  SE: 'Sudeste',
  S: 'Sul',
  SW: 'Sudoeste',
  W: 'Oeste',
  NW: 'Noroeste',
}
