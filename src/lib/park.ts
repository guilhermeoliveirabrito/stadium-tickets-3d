import { CatmullRomCurve3, Vector3 } from 'three'
import { BOWL } from '../config/stadium'
import { SUN_DIRECTION } from '../config/world'
import { fbm, mulberry32 } from './random'

/** Lado do terreno detalhado (m). Fora dele o chão vira uma cor contínua sob a neblina. */
export const PARK_SIZE = 1400

export const PLAZA_D = 76
export const RING_ROAD_D = 122

export interface PathSpec {
  kind: 'road' | 'walk'
  width: number
  points: [number, number][]
  closed?: boolean
}

export interface TreeSpec {
  x: number
  z: number
  radius: number
  height: number
  variant: number
  tint: number
}

export interface Lake {
  outline: [number, number][]
}

/** Distância de um ponto ao contorno da primeira fileira (o mesmo d usado no estádio). */
export function bowlDistance(x: number, z: number) {
  const ix = BOWL.halfX - BOWL.radius
  const iz = BOWL.halfZ - BOWL.radius
  const qx = Math.abs(x) - ix
  const qz = Math.abs(z) - iz
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0))
  return outside + Math.min(Math.max(qx, qz), 0) - BOWL.radius
}

function roundedLoop(d: number, step = 6): [number, number][] {
  const hx = BOWL.halfX - BOWL.radius
  const hz = BOWL.halfZ - BOWL.radius
  const r = BOWL.radius + d
  const pts: [number, number][] = []
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

function smoothPath(control: [number, number][], closed = false, spacing = 4): [number, number][] {
  const curve = new CatmullRomCurve3(
    control.map(([x, z]) => new Vector3(x, 0, z)),
    closed,
    'centripetal',
  )
  const n = Math.max(8, Math.ceil(curve.getLength() / spacing))
  return curve.getSpacedPoints(n).map((p) => [p.x, p.z])
}

export const PATHS: PathSpec[] = [
  { kind: 'road', width: 12, points: roundedLoop(RING_ROAD_D), closed: true },
  { kind: 'road', width: 11, points: smoothPath([[188, 10], [300, 30], [420, 150], [560, 190], [760, 170]]) },
  { kind: 'road', width: 11, points: smoothPath([[-120, -170], [-190, -300], [-380, -430], [-560, -520], [-760, -560]]) },
  { kind: 'road', width: 10, points: smoothPath([[30, 166], [55, 300], [-60, 460], [-40, 600], [-80, 760]]) },
  { kind: 'walk', width: 5, points: smoothPath([[0, -110], [10, -200], [70, -300], [190, -360], [260, -470], [250, -620]]) },
  { kind: 'walk', width: 5, points: smoothPath([[-140, 80], [-230, 150], [-260, 260], [-380, 330], [-520, 300], [-640, 380]]) },
  { kind: 'walk', width: 5, points: smoothPath([[150, -60], [240, -120], [330, -110], [420, -200], [560, -230], [700, -330]]) },
  { kind: 'walk', width: 4.5, points: smoothPath([[300, -300], [400, -330], [450, -260], [380, -200], [300, -240]], true) },
  { kind: 'walk', width: 4.5, points: smoothPath([[-330, -170], [-260, -240], [-300, -330], [-420, -300], [-450, -210]], true) },
  { kind: 'walk', width: 4.5, points: smoothPath([[150, 120], [210, 210], [190, 330], [260, 420], [380, 430], [470, 520]]) },
  { kind: 'walk', width: 4.5, points: smoothPath([[-200, -40], [-300, -60], [-390, 10], [-470, 0], [-560, -80], [-700, -60]]) },
]

export const LAKE: Lake = (() => {
  const cx = 340
  const cz = 260
  const outline: [number, number][] = []
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2
    const wobble = 0.82 + fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5, 3, 9) * 0.45
    outline.push([cx + Math.cos(a) * 78 * wobble, cz + Math.sin(a) * 44 * wobble])
  }
  return { outline }
})()

function pointInPolygon(x: number, z: number, poly: [number, number][]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

function distanceToPolyline(x: number, z: number, pts: [number, number][], closed: boolean) {
  let best = Infinity
  const n = closed ? pts.length : pts.length - 1
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[(i + 1) % pts.length]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
    const ex = ax + dx * t - x
    const ez = az + dz * t - z
    best = Math.min(best, ex * ex + ez * ez)
  }
  return Math.sqrt(best)
}

/** Grade espacial simples para acelerar consultas de distância aos caminhos. */
function buildPathIndex(cell = 40) {
  const map = new Map<string, { path: PathSpec; a: [number, number]; b: [number, number] }[]>()
  for (const path of PATHS) {
    const n = path.closed ? path.points.length : path.points.length - 1
    for (let i = 0; i < n; i++) {
      const a = path.points[i]
      const b = path.points[(i + 1) % path.points.length]
      const x0 = Math.floor((Math.min(a[0], b[0]) - 20) / cell)
      const x1 = Math.floor((Math.max(a[0], b[0]) + 20) / cell)
      const z0 = Math.floor((Math.min(a[1], b[1]) - 20) / cell)
      const z1 = Math.floor((Math.max(a[1], b[1]) + 20) / cell)
      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const key = `${gx},${gz}`
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push({ path, a, b })
        }
      }
    }
  }
  return (x: number, z: number) => {
    const list = map.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`)
    if (!list) return Infinity
    let best = Infinity
    for (const { path, a, b } of list) {
      const d = distanceToPolyline(x, z, [a, b], false) - path.width / 2
      if (d < best) best = d
    }
    return best
  }
}

export function plantTrees(): TreeSpec[] {
  const rand = mulberry32(2026)
  const nearPath = buildPathIndex()
  const half = PARK_SIZE / 2 - 10
  const trees: TreeSpec[] = []

  const push = (x: number, z: number, scale = 1) => {
    const forest = fbm(x * 0.006 + 40, z * 0.006 + 40, 3, 5)
    trees.push({
      x,
      z,
      radius: (2.8 + rand() * rand() * 4.2) * scale,
      height: 0,
      variant: rand() < 0.16 ? 1 : rand() < 0.7 ? 0 : 2,
      tint: forest * 0.6 + rand() * 0.4,
    })
  }

  // alamedas formais na borda da praça
  for (let i = 0; i < 2; i++) {
    const loop = roundedLoop(PLAZA_D - 6 + i * 9, 13)
    for (const [x, z] of loop) if (nearPath(x, z) > 3) push(x, z, 0.85)
  }

  const step = 7.4
  for (let x = -half; x < half; x += step) {
    for (let z = -half; z < half; z += step) {
      const px = x + (rand() - 0.5) * step * 0.9
      const pz = z + (rand() - 0.5) * step * 0.9
      const d = bowlDistance(px, pz)
      if (d < PLAZA_D + 10) continue
      if (Math.abs(d - RING_ROAD_D) < 13) continue
      if (nearPath(px, pz) < 4 + rand() * 3) continue
      if (pointInPolygon(px, pz, LAKE.outline) || distanceToPolyline(px, pz, LAKE.outline, true) < 9) continue
      const density = fbm(px * 0.0055, pz * 0.0055, 4, 3)
      const edge = Math.min(1, (half - Math.max(Math.abs(px), Math.abs(pz))) / 60)
      const threshold = 0.52 - edge * 0.02
      if (density > threshold || rand() < 0.02) push(px, pz)
    }
  }

  for (const t of trees) t.height = t.radius * (t.variant === 1 ? 3.1 : 1.9) + 1.5
  return trees
}

/** Direção da sombra projetada no chão (unitária) e comprimento por metro de altura. */
export const SHADOW = (() => {
  const len = Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.z)
  return {
    dx: -SUN_DIRECTION.x / len,
    dz: -SUN_DIRECTION.z / len,
    perMeter: len / SUN_DIRECTION.y,
  }
})()
