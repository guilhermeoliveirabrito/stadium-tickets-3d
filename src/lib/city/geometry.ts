import { BOWL } from '../../config/stadium'

export type Vec2 = [number, number]

/** Distância de um ponto ao contorno da primeira fileira (o mesmo d usado no estádio). */
export function bowlDistance(x: number, z: number) {
  const ix = BOWL.halfX - BOWL.radius
  const iz = BOWL.halfZ - BOWL.radius
  const qx = Math.abs(x) - ix
  const qz = Math.abs(z) - iz
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0))
  return outside + Math.min(Math.max(qx, qz), 0) - BOWL.radius
}

/** Curva paralela ao contorno do estádio, na distância d, no sentido horário. */
export function roundedLoop(d: number, step = 6): Vec2[] {
  const hx = BOWL.halfX - BOWL.radius
  const hz = BOWL.halfZ - BOWL.radius
  const r = BOWL.radius + d
  const pts: Vec2[] = []
  const corners: [number, number, number][] = [
    [hx, -hz, -Math.PI / 2],
    [hx, hz, 0],
    [-hx, hz, Math.PI / 2],
    [-hx, -hz, Math.PI],
  ]
  for (const [cx, cz, a0] of corners) {
    const n = Math.ceil(((Math.PI / 2) * r) / step)
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2)
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
    }
  }
  return pts
}

export function segmentDistance(x: number, z: number, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)
}

export function polylineDistance(x: number, z: number, pts: Vec2[], closed = false) {
  let best = Infinity
  const n = closed ? pts.length : pts.length - 1
  for (let i = 0; i < n; i++) best = Math.min(best, segmentDistance(x, z, pts[i], pts[(i + 1) % pts.length]))
  return best
}

export function pointInPolygon(x: number, z: number, poly: Vec2[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export interface Rect {
  x0: number
  z0: number
  x1: number
  z1: number
}

export const inRect = (x: number, z: number, r: Rect, margin = 0) =>
  x > r.x0 - margin && x < r.x1 + margin && z > r.z0 - margin && z < r.z1 + margin

/** Grade espacial para consultas rápidas de "o que está perto deste ponto". */
export class SpatialHash<T> {
  private cells = new Map<number, T[]>()
  private size: number

  constructor(size: number) {
    this.size = size
  }

  private key(cx: number, cz: number) {
    return (cx + 4096) * 8192 + (cz + 4096)
  }

  insert(item: T, x0: number, z0: number, x1: number, z1: number) {
    const s = this.size
    for (let cx = Math.floor(x0 / s); cx <= Math.floor(x1 / s); cx++) {
      for (let cz = Math.floor(z0 / s); cz <= Math.floor(z1 / s); cz++) {
        const k = this.key(cx, cz)
        let list = this.cells.get(k)
        if (!list) this.cells.set(k, (list = []))
        list.push(item)
      }
    }
  }

  query(x: number, z: number, radius: number) {
    const s = this.size
    const out = new Set<T>()
    for (let cx = Math.floor((x - radius) / s); cx <= Math.floor((x + radius) / s); cx++) {
      for (let cz = Math.floor((z - radius) / s); cz <= Math.floor((z + radius) / s); cz++) {
        const list = this.cells.get(this.key(cx, cz))
        if (list) for (const item of list) out.add(item)
      }
    }
    return out
  }
}
