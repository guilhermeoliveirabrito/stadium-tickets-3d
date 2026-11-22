import { CatmullRomCurve3, Vector3 } from 'three'
import { fbm, mulberry32, type Random } from '../random'
import {
  bowlDistance,
  inRect,
  pointInPolygon,
  polylineDistance,
  type Rect,
  roundedLoop,
  segmentDistance,
  SpatialHash,
  type Vec2,
} from './geometry'

/**
 * Entorno do estádio, inspirado em arenas reais: o estádio fica numa esplanada
 * iluminada, colada ao estacionamento. Uma única via de acesso liga a avenida
 * principal ao estacionamento, e uma saída ao norte leva aos bairros. A cidade
 * começa depois de uma faixa verde, e os prédios altos ficam ao fundo.
 */

/** Lado do terreno detalhado (m). Fora dele fica só o skyline, no escuro. */
export const WORLD = 1400
export const HALF = WORLD / 2
export const PLAZA_D = 86
export const AVENUE_WIDTH = 22
export const ACCESS_WIDTH = 10
export const STREET_WIDTH = 9
export const SIDEWALK = 2.6

const EDGE = HALF - 8
/** distância mínima (a partir do contorno do estádio) para começar a cidade */
const CITY_D = 205

export type RoadKind = 'avenue' | 'access' | 'street'

export interface Road {
  kind: RoadKind
  width: number
  points: Vec2[]
  closed?: boolean
  /** rua das vilinhas perto do complexo (só casas pequenas) */
  village?: boolean
}

export interface Turnaround {
  x: number
  z: number
  r: number
}

export interface Intersection {
  x: number
  z: number
  /** meia largura e meia profundidade da área comum às duas vias */
  hx: number
  hz: number
  crosswalk: boolean
}

export interface Stall {
  x: number
  z: number
  yaw: number
  occupied: boolean
}

export interface ParkingLot extends Rect {
  /** z da borda da entrada (sul) e da borda da saída (norte) */
  nearZ: number
  farZ: number
  /** sentido da entrada para o fundo (-1 = para o norte) */
  side: 1 | -1
  /** x do eixo de cada corredor (os corredores correm ao longo de z) */
  aisles: number[]
  /** z das faixas de circulação da entrada e do fundo */
  frontLane: number
  backLane: number
  /** x da entrada (ao sul) e da saída (ao norte) */
  gate: number
  stalls: Stall[]
}

export type BuildingKind = 'house' | 'apartment' | 'tower'

export interface Building {
  x: number
  z: number
  w: number
  d: number
  h: number
  yaw: number
  kind: BuildingKind
  color: string
  seed: number
  gable: boolean
  /** lojas acesas no térreo */
  shops: boolean
  /** casa das vilinhas perto do complexo */
  village?: boolean
}

export type LampKind = 'street' | 'lot' | 'plaza' | 'park'

export interface Lamp {
  x: number
  z: number
  /** direção do braço (para onde a luz aponta) */
  yaw: number
  kind: LampKind
}

export interface Pool {
  x: number
  z: number
  w: number
  d: number
  yaw: number
}

export interface Porch {
  x: number
  z: number
  yaw: number
  w: number
  d: number
  lit: boolean
}

export interface TreeSpec {
  x: number
  z: number
  radius: number
  height: number
  /** 0 copa redonda, 1 pinheiro, 2 copa dupla, 3 palmeira */
  variant: number
  tint: number
}

export interface CityLayout {
  roads: Road[]
  avenue: Road
  /** via de acesso ao estacionamento e saída para os bairros */
  access: Road
  exit: Road
  intersections: Intersection[]
  turnarounds: Turnaround[]
  lot: ParkingLot
  forecourt: Rect
  buildings: Building[]
  trees: TreeSpec[]
  lamps: Lamp[]
  pools: Pool[]
  porches: Porch[]
  lake: Vec2[]
  park: Rect
  walks: Road[]
}

// --------------------------------------------------------------------------
// zonas fixas do complexo

/** pátio que liga a esplanada ao estacionamento */
export const FORECOURT: Rect = { x0: -206, x1: -140, z0: -112, z1: 112 }

// as duas portarias ficam no lado leste, colado ao pátio, que aparece na vista aérea
const LOT_SPEC = { x0: -398, x1: -206, nearZ: 150, farZ: -150, gate: -212 }
const LOT_RECT: Rect = { x0: LOT_SPEC.x0, x1: LOT_SPEC.x1, z0: LOT_SPEC.farZ, z1: LOT_SPEC.nearZ }

export const PARK: Rect = { x0: 200, z0: -112, x1: 330, z1: 128 }
const LAKE_CENTER: Vec2 = [266, 8]

const LAKE: Vec2[] = (() => {
  const out: Vec2[] = []
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2
    const wobble = 0.84 + fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5, 3, 9) * 0.4
    out.push([LAKE_CENTER[0] + Math.cos(a) * 40 * wobble, LAKE_CENTER[1] + Math.sin(a) * 74 * wobble])
  }
  return out
})()

/**
 * Duas vilinhas de casas baixas nos cantos que aparecem na vista aérea,
 * ainda separadas da esplanada pelos jardins.
 */
const VILLAGES: Rect[] = [
  { x0: 135, x1: 292, z0: -190, z1: -126 },
  { x0: 100, x1: 245, z0: 130, z1: 216 },
]
const CUL_DE_SAC: Turnaround = { x: 158, z: -155, r: 8 }

/** área reservada ao complexo (estádio, esplanada, estacionamento e parque) */
function complexZone(x: number, z: number, margin = 0) {
  return (
    bowlDistance(x, z) < CITY_D + margin ||
    inRect(x, z, LOT_RECT, 56 + margin) ||
    inRect(x, z, PARK, 6 + margin)
  )
}

// --------------------------------------------------------------------------
// vias

function smoothPath(control: Vec2[], closed = false, spacing = 4): Vec2[] {
  const curve = new CatmullRomCurve3(
    control.map(([x, z]) => new Vector3(x, 0, z)),
    closed,
    'centripetal',
  )
  const n = Math.max(8, Math.ceil(curve.getLength() / spacing))
  return curve.getSpacedPoints(n).map((p) => [p.x, p.z] as Vec2)
}

/** Avenida principal: passa ao sul do complexo, com uma curva suave. */
const AVENUE_POINTS = smoothPath(
  [
    [-HALF - 60, 262],
    [-470, 232],
    [-220, 207],
    [40, 204],
    [300, 222],
    [520, 250],
    [HALF + 60, 292],
  ],
  false,
  5,
)

/** z do eixo da avenida em um x qualquer */
export function avenueZ(x: number) {
  const pts = AVENUE_POINTS
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i]
    const [x1, z1] = pts[i + 1]
    if (x >= x0 && x <= x1) return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0 || 1)
  }
  return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1]
}

const XS = [-630, -540, -450, -360, -270, -180, -90, 0, 90, 180, 270, 360, 450, 540, 630]
const ZS = [-690, -615, -540, -460, -380, -300, -230, -155, -80, 0, 80, 155, 340, 410, 480, 550, 620, 690]

function streetPointOk(x: number, z: number) {
  if (Math.abs(x) > EDGE || Math.abs(z) > EDGE) return false
  if (complexZone(x, z, 22)) return false
  if (Math.abs(z - avenueZ(x)) < AVENUE_WIDTH / 2 + 24) return false
  return true
}

function segmentOk(a: Vec2, b: Vec2, check = streetPointOk) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(2, Math.ceil(len / 6))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    if (!check(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false
  }
  return true
}

function buildRoads() {
  const avenue: Road = { kind: 'avenue', width: AVENUE_WIDTH, points: AVENUE_POINTS }
  const gateX = LOT_SPEC.gate
  // portaria sul: via curta e reta até a avenida
  const access: Road = {
    kind: 'access',
    width: ACCESS_WIDTH,
    points: [
      [gateX, avenueZ(gateX)],
      [gateX, LOT_SPEC.nearZ - 4],
    ],
  }
  // portaria norte: sobe e faz uma curva até o bairro
  const exit: Road = {
    kind: 'access',
    width: ACCESS_WIDTH,
    points: smoothPath([
      [gateX, LOT_SPEC.farZ + 4],
      [gateX, LOT_SPEC.farZ - 16],
      [gateX - 4, -200],
      [-236, -252],
      [-262, -284],
      [-270, -300],
    ]),
  }
  const roads: Road[] = [avenue, access, exit]

  const nodes = new Map<string, { x: number; z: number; count: number }>()
  const touch = (x: number, z: number) => {
    const k = `${Math.round(x)},${Math.round(z)}`
    const node = nodes.get(k) ?? { x, z, count: 0 }
    node.count++
    nodes.set(k, node)
  }
  const addStreet = (a: Vec2, b: Vec2, village = false) => {
    roads.push({ kind: 'street', width: STREET_WIDTH, points: [a, b], village })
    touch(a[0], a[1])
    touch(b[0], b[1])
  }

  for (const x of XS) {
    for (let i = 0; i < ZS.length - 1; i++) {
      const a: Vec2 = [x, ZS[i]]
      const b: Vec2 = [x, ZS[i + 1]]
      if (segmentOk(a, b)) addStreet(a, b)
    }
  }
  for (const z of ZS) {
    for (let i = 0; i < XS.length - 1; i++) {
      const a: Vec2 = [XS[i], z]
      const b: Vec2 = [XS[i + 1], z]
      if (segmentOk(a, b)) addStreet(a, b)
    }
  }

  // ruas que chegam até a avenida, dos dois lados
  const avenueJunctions: Vec2[] = []
  for (const x of XS) {
    const az = avenueZ(x)
    for (const dir of [1, -1]) {
      const candidates = ZS.filter((z) => (dir > 0 ? z > az : z < az)).sort((p, q) => Math.abs(p - az) - Math.abs(q - az))
      const z = candidates[0]
      if (z === undefined || !nodes.has(`${x},${z}`)) continue
      const end: Vec2 = [x, az + dir * (AVENUE_WIDTH / 2 - 0.5)]
      const ok = segmentOk([x, z], end, (px, pz) => !complexZone(px, pz, 22) && Math.abs(px) <= EDGE)
      if (!ok) continue
      addStreet([x, z], end)
      avenueJunctions.push([x, az])
    }
  }

  // ruas das vilinhas: uma sem saída a nordeste e um "U" saindo da avenida a sudeste
  const hasStreet = (a: Vec2, b: Vec2) =>
    roads.some(
      (r) =>
        r.kind === 'street' &&
        ((r.points[0][0] === a[0] && r.points[0][1] === a[1] && r.points[1][0] === b[0] && r.points[1][1] === b[1]) ||
          (r.points[0][0] === b[0] && r.points[0][1] === b[1] && r.points[1][0] === a[0] && r.points[1][1] === a[1])),
    )
  const edgeZ = (x: number) => avenueZ(x) - (AVENUE_WIDTH / 2 - 0.5)
  const villageStreets: [Vec2, Vec2][] = [
    [[270, -230], [270, -155]],
    [[270, -155], [CUL_DE_SAC.x, CUL_DE_SAC.z]],
    [[125, edgeZ(125)], [125, 150]],
    [[125, 150], [215, 150]],
    [[215, 150], [215, edgeZ(215)]],
  ]
  for (const [a, b] of villageStreets) if (!hasStreet(a, b)) addStreet(a, b, true)
  avenueJunctions.push([125, avenueZ(125)], [215, avenueZ(215)])

  const streetHalf = STREET_WIDTH / 2
  const avenueHalf = AVENUE_WIDTH / 2
  const intersections: Intersection[] = [
    { x: access.points[0][0], z: access.points[0][1], hx: ACCESS_WIDTH / 2 + 2, hz: avenueHalf, crosswalk: true },
  ]
  for (const [x, z] of avenueJunctions) intersections.push({ x, z, hx: streetHalf, hz: avenueHalf, crosswalk: true })
  for (const n of nodes.values()) {
    if (n.count >= 2) intersections.push({ x: n.x, z: n.z, hx: streetHalf, hz: streetHalf, crosswalk: false })
  }
  return { roads, avenue, access, exit, intersections, turnarounds: [CUL_DE_SAC] }
}

/** Índice dos segmentos de via para medir distâncias rapidamente. */
function roadIndex(roads: Road[]) {
  const hash = new SpatialHash<{ road: Road; a: Vec2; b: Vec2 }>(40)
  for (const road of roads) {
    const n = road.closed ? road.points.length : road.points.length - 1
    for (let i = 0; i < n; i++) {
      const a = road.points[i]
      const b = road.points[(i + 1) % road.points.length]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const parts = Math.max(1, Math.ceil(len / 30))
      for (let k = 0; k < parts; k++) {
        const pa: Vec2 = [a[0] + ((b[0] - a[0]) * k) / parts, a[1] + ((b[1] - a[1]) * k) / parts]
        const pb: Vec2 = [a[0] + ((b[0] - a[0]) * (k + 1)) / parts, a[1] + ((b[1] - a[1]) * (k + 1)) / parts]
        const pad = road.width
        hash.insert(
          { road, a: pa, b: pb },
          Math.min(pa[0], pb[0]) - pad,
          Math.min(pa[1], pb[1]) - pad,
          Math.max(pa[0], pb[0]) + pad,
          Math.max(pa[1], pb[1]) + pad,
        )
      }
    }
  }
  /** folga até a calçada mais próxima (negativo = em cima da via ou da calçada) */
  return (x: number, z: number, radius = 30) => {
    let best = Infinity
    for (const { road, a, b } of hash.query(x, z, radius)) {
      best = Math.min(best, segmentDistance(x, z, a, b) - road.width / 2 - SIDEWALK)
    }
    return best
  }
}

// --------------------------------------------------------------------------
// estacionamento

function buildLot(rand: Random): ParkingLot {
  const spec = LOT_SPEC
  const side = -1
  const module = 17
  const count = Math.floor((spec.x1 - spec.x0 - 6) / module)
  const margin = (spec.x1 - spec.x0 - count * module) / 2
  const rowStart = spec.nearZ + side * 7
  const rowEnd = spec.farZ - side * 7
  const span = Math.abs(rowEnd - rowStart)
  const perRow = Math.floor(span / 2.6)
  const rowMargin = (span - perRow * 2.6) / 2

  const aisles: number[] = []
  const stalls: Stall[] = []
  for (let k = 0; k < count; k++) {
    const mx = spec.x0 + margin + module * k
    aisles.push(mx + 8.5)
    for (const [cx, facing] of [
      [mx + 2.5, -1],
      [mx + 14.5, 1],
    ] as const) {
      for (let i = 0; i < perRow; i++) {
        const z = rowStart + side * (rowMargin + 1.3 + i * 2.6)
        // lotado perto do estádio, com mais vagas livres no fundo
        const nearPlaza = (cx - spec.x0) / (spec.x1 - spec.x0)
        const occupied = rand() < 0.5 + nearPlaza * 0.42
        const dir = rand() < 0.8 ? facing : -facing
        stalls.push({ x: cx, z, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2, occupied })
      }
    }
  }
  return {
    ...LOT_RECT,
    nearZ: spec.nearZ,
    farZ: spec.farZ,
    side,
    aisles,
    frontLane: spec.nearZ + side * 3.5,
    backLane: spec.farZ - side * 3.5,
    gate: spec.gate,
    stalls,
  }
}

// --------------------------------------------------------------------------
// prédios

const HOUSE_COLORS = ['#d9d2c3', '#c9b8a0', '#e6e1d8', '#b7a99a', '#cfd6d6', '#d8c3a5', '#a9b4b8', '#e0cfc0', '#bfb2a2']
const APARTMENT_COLORS = ['#b9b6ae', '#a7a39b', '#c8c2b6', '#9aa0a6', '#d2cbbd', '#8f949a']
const TOWER_COLORS = ['#3c4654', '#4a5361', '#2f3742', '#56606d', '#444b55']

interface Placement {
  buildings: Building[]
  trees: TreeSpec[]
  pools: Pool[]
  porches: Porch[]
}

function placeBuildings(rand: Random, roads: Road[], clearance: (x: number, z: number) => number): Placement {
  const out: Placement = { buildings: [], trees: [], pools: [], porches: [] }
  const footprints = new SpatialHash<{ x: number; z: number; r: number }>(40)

  const fits = (x: number, z: number, w: number, d: number, yaw: number) => {
    const r = Math.hypot(w, d) / 2
    if (Math.abs(x) > EDGE - r || Math.abs(z) > EDGE - r) return false
    // do outro lado da avenida os prédios podem ficar de frente para o complexo
    const acrossAvenue = z - r > avenueZ(x) + AVENUE_WIDTH / 2
    const inVillage = VILLAGES.some((v) => inRect(x, z, v))
    if (inVillage) {
      if (bowlDistance(x, z) < PLAZA_D + 38 + r || inRect(x, z, PARK, 4 + r)) return false
      if (Math.hypot(x - CUL_DE_SAC.x, z - CUL_DE_SAC.z) < CUL_DE_SAC.r + SIDEWALK + r) return false
    } else if (acrossAvenue ? inRect(x, z, LOT_RECT, 40 + r) : complexZone(x, z, r - 10)) {
      return false
    }
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    for (const [lx, lz] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ]) {
      if (clearance(x + lx * c + lz * s, z - lx * s + lz * c) < 1.2) return false
    }
    for (const f of footprints.query(x, z, r + 30)) {
      if (Math.hypot(f.x - x, f.z - z) < f.r + r - 1.5) return false
    }
    return true
  }

  const add = (b: Building) => {
    out.buildings.push(b)
    const r = Math.hypot(b.w, b.d) / 2
    footprints.insert({ x: b.x, z: b.z, r }, b.x - r, b.z - r, b.x + r, b.z + r)
  }

  const frontage = (a: Vec2, b: Vec2, road: Road) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz)
    if (len < 12) return
    const tx = dx / len
    const tz = dz / len
    const yaw = Math.atan2(-tz, tx)
    const avenue = road.kind === 'avenue'
    for (const side of [1, -1]) {
      const nx = -tz * side
      const nz = tx * side
      let t = avenue ? 2 : 13
      while (t < len - (avenue ? 2 : 13)) {
        const kind: BuildingKind = road.village
          ? 'house'
          : avenue
            ? rand() < 0.8
              ? 'apartment'
              : 'house'
            : rand() < 0.1
              ? 'apartment'
              : 'house'
        let w: number
        let d: number
        let h: number
        let setback: number
        if (kind === 'apartment') {
          w = 16 + rand() * 12
          d = 13 + rand() * 7
          const floors = avenue ? 4 + Math.floor(rand() * 9) : 3 + Math.floor(rand() * 3)
          h = floors * 3.1 + 0.8
          setback = 3 + rand() * 2
        } else if (road.village) {
          // casinhas térreas ou de dois andares
          w = 7 + rand() * 3
          d = 8 + rand() * 3
          const floors = rand() < 0.55 ? 1 : 2
          h = floors * 3.0 + 0.4
          setback = 4 + rand() * 2
        } else {
          w = 8 + rand() * 4
          d = 9 + rand() * 4
          const floors = rand() < 0.28 ? 1 : rand() < 0.9 ? 2 : 3
          h = floors * 3.0 + 0.4
          setback = 4 + rand() * 2.5
        }
        const along = t + w / 2
        if (along + w / 2 > len - 2) break
        const offset = road.width / 2 + SIDEWALK + setback + d / 2
        const x = a[0] + tx * along + nx * offset
        const z = a[1] + tz * along + nz * offset
        const facing = side > 0 ? yaw : yaw + Math.PI
        if (fits(x, z, w, d, facing)) {
          const colors = kind === 'apartment' ? APARTMENT_COLORS : HOUSE_COLORS
          add({
            x,
            z,
            w,
            d,
            h,
            yaw: facing,
            kind,
            color: colors[Math.floor(rand() * colors.length)],
            seed: rand(),
            gable: kind === 'house' && rand() < 0.88,
            shops: kind === 'apartment' && avenue && rand() < 0.8,
            village: road.village,
          })
          if (kind === 'house') {
            const fx = x - nx * (d / 2)
            const fz = z - nz * (d / 2)
            out.porches.push({
              x: fx - nx * (setback / 2) + tx * (w / 2 - 2),
              z: fz - nz * (setback / 2) + tz * (w / 2 - 2),
              yaw: facing,
              w: 3,
              d: setback,
              lit: rand() < 0.62,
            })
            const back = d / 2 + 5 + rand() * 4
            if (rand() < 0.5) {
              out.trees.push(tree(rand, x + nx * back + tx * (rand() - 0.5) * w, z + nz * back + tz * (rand() - 0.5) * w, 0.85))
            }
            if (rand() < 0.17) {
              out.pools.push({ x: x + nx * (d / 2 + 5.5), z: z + nz * (d / 2 + 5.5), w: 3.6, d: 7, yaw: facing + Math.PI / 2 })
            }
          }
        }
        t += w + (kind === 'apartment' ? 3 + rand() * 4 : 2.5 + rand() * 2.5)
      }
    }
  }

  // avenida primeiro (prédios com lojas), depois as ruas dos bairros
  const avenue = roads.find((r) => r.kind === 'avenue')!
  for (let i = 0; i < avenue.points.length - 1; i += 5) {
    frontage(avenue.points[i], avenue.points[Math.min(i + 5, avenue.points.length - 1)], avenue)
  }
  for (const road of roads.filter((r) => r.kind === 'street')) frontage(road.points[0], road.points[1], road)
  return out
}

/** Skyline além do terreno detalhado, mais denso a nordeste (atrás do estádio na abertura). */
function placeSkyline(rand: Random): Building[] {
  const out: Building[] = []
  const placed = new SpatialHash<{ x: number; z: number; r: number }>(80)
  const downtown = (50 * Math.PI) / 180
  let attempts = 0
  while (out.length < 440 && attempts++ < 7000) {
    const angle = rand() * Math.PI * 2
    const dist = 760 + Math.pow(rand(), 0.8) * 900
    const x = Math.sin(angle) * dist
    const z = -Math.cos(angle) * dist
    const towards = Math.cos(angle - downtown)
    const density = 0.25 + Math.max(0, towards) * 0.75
    if (rand() > density) continue
    const tall = towards > 0.7 && rand() < 0.55
    const w = tall ? 22 + rand() * 22 : 20 + rand() * 30
    const d = tall ? 22 + rand() * 22 : 16 + rand() * 24
    const h = tall ? 60 + rand() * 120 : 14 + rand() * 40
    const r = Math.hypot(w, d) / 2
    let clear = true
    for (const p of placed.query(x, z, r + 60)) {
      if (Math.hypot(p.x - x, p.z - z) < p.r + r + 6) clear = false
    }
    if (!clear) continue
    placed.insert({ x, z, r }, x - r, z - r, x + r, z + r)
    out.push({
      x,
      z,
      w,
      d,
      h,
      yaw: (Math.round(rand() * 3) * Math.PI) / 2 + (rand() - 0.5) * 0.1,
      kind: 'tower',
      color: TOWER_COLORS[Math.floor(rand() * TOWER_COLORS.length)],
      seed: rand(),
      gable: false,
      shops: false,
    })
  }
  return out
}

// --------------------------------------------------------------------------
// postes

function along(
  points: Vec2[],
  spacing: number,
  closed: boolean,
  offset: number,
  cb: (x: number, z: number, nx: number, nz: number) => void,
) {
  const n = closed ? points.length : points.length - 1
  let carry = spacing / 2
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz)
    if (len === 0) continue
    const nx = -dz / len
    const nz = dx / len
    let t = carry
    while (t < len) {
      cb(a[0] + (dx * t) / len + nx * offset, a[1] + (dz * t) / len + nz * offset, nx, nz)
      t += spacing
    }
    carry = t - len
  }
}

function placeLamps(roads: Road[], lot: ParkingLot, walks: Road[], clearance: (x: number, z: number) => number): Lamp[] {
  const lamps: Lamp[] = []
  const push = (x: number, z: number, nx: number, nz: number, side: number, kind: LampKind) => {
    // o braço aponta para o meio da via
    lamps.push({ x, z, yaw: Math.atan2(-nx * side, -nz * side), kind })
  }
  for (const road of roads) {
    const spacing = road.kind === 'street' ? 40 : road.kind === 'access' ? 24 : 30
    const offset = road.width / 2 + 1.1
    for (const side of [1, -1]) {
      if (road.kind === 'street' && side < 0) continue
      along(road.points, spacing, !!road.closed, offset * side, (x, z, nx, nz) => {
        if (clearance(x, z) < -SIDEWALK - 0.5) return
        if (inRect(x, z, LOT_RECT, -1)) return
        push(x, z, nx, nz, side, 'street')
      })
    }
  }
  // estacionamento: postes altos entre as fileiras
  const z0 = Math.min(lot.nearZ, lot.farZ) + 12
  const z1 = Math.max(lot.nearZ, lot.farZ) - 12
  for (let k = 0; k <= lot.aisles.length; k++) {
    const x = k === lot.aisles.length ? lot.aisles[k - 1] + 8.5 : lot.aisles[k] - 8.5
    for (let z = z0; z <= z1; z += 30) lamps.push({ x, z, yaw: 0, kind: 'lot' })
  }
  // esplanada: dois anéis de postes e uma grade no pátio
  along(roundedLoop(64, 4), 15, true, 0, (x, z) => lamps.push({ x, z, yaw: 0, kind: 'plaza' }))
  along(roundedLoop(PLAZA_D - 6, 4), 15, true, 0, (x, z) => {
    if (x < FORECOURT.x1 + 4 && Math.abs(z) < FORECOURT.z1) return
    lamps.push({ x, z, yaw: 0, kind: 'plaza' })
  })
  for (let x = FORECOURT.x0 + 8; x < FORECOURT.x1 - 4; x += 15) {
    for (let z = FORECOURT.z0 + 8; z < FORECOURT.z1; z += 15) lamps.push({ x, z, yaw: 0, kind: 'plaza' })
  }
  for (const walk of walks) along(walk.points, 22, !!walk.closed, 2.6, (x, z, nx, nz) => push(x, z, nx, nz, 1, 'park'))
  return lamps
}

// --------------------------------------------------------------------------
// árvores e palmeiras

function tree(rand: Random, x: number, z: number, scale = 1): TreeSpec {
  const radius = (2.6 + rand() * rand() * 3.6) * scale
  const variant = rand() < 0.16 ? 1 : rand() < 0.7 ? 0 : 2
  return {
    x,
    z,
    radius,
    height: radius * (variant === 1 ? 3.1 : 1.9) + 1.5,
    variant,
    tint: fbm(x * 0.006 + 40, z * 0.006 + 40, 3, 5) * 0.6 + rand() * 0.4,
  }
}

function palm(rand: Random, x: number, z: number): TreeSpec {
  return { x, z, radius: 3.2 + rand() * 1.2, height: 8 + rand() * 5, variant: 3, tint: rand() }
}

function plantTrees(rand: Random, lot: ParkingLot, clearance: (x: number, z: number) => number, buildings: Building[]) {
  const trees: TreeSpec[] = []
  const occupied = new SpatialHash<{ x: number; z: number; r: number }>(40)
  for (const b of buildings) {
    const r = Math.hypot(b.w, b.d) / 2 + 2
    occupied.insert({ x: b.x, z: b.z, r }, b.x - r, b.z - r, b.x + r, b.z + r)
  }
  const free = (x: number, z: number, r: number) => {
    for (const o of occupied.query(x, z, r + 30)) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false
    return true
  }
  const onPaving = (x: number, z: number, margin = 0) =>
    bowlDistance(x, z) < PLAZA_D + margin || inRect(x, z, FORECOURT, margin) || inRect(x, z, lot, margin)

  // palmeiras em volta da esplanada e no canteiro da avenida
  along(roundedLoop(PLAZA_D + 5, 4), 13, true, 0, (x, z) => {
    if (inRect(x, z, FORECOURT, 6) || clearance(x, z) < 1) return
    trees.push(palm(rand, x, z))
  })
  for (let x = -200; x < 330; x += 15) {
    const z = avenueZ(x) - (AVENUE_WIDTH / 2 + SIDEWALK + 1.8)
    if (clearance(x, z) > 0.3) trees.push(palm(rand, x, z))
  }

  // jardins do complexo e manchas de árvores entre a esplanada e a cidade
  const step = 7
  for (let x = -HALF + 10; x < HALF - 10; x += step) {
    for (let z = -HALF + 10; z < HALF - 10; z += step) {
      const px = x + (rand() - 0.5) * step * 0.9
      const pz = z + (rand() - 0.5) * step * 0.9
      const inComplex = complexZone(px, pz, 30)
      const density = fbm(px * 0.0065, pz * 0.0065, 4, 3)
      if (inComplex) {
        if (density < 0.44 && rand() > 0.06) continue
      } else if (density < 0.62) {
        continue
      }
      if (onPaving(px, pz, 8)) continue
      if (clearance(px, pz) < 2.5) continue
      if (pointInPolygon(px, pz, LAKE) || polylineDistance(px, pz, LAKE, true) < 8) continue
      if (!free(px, pz, 4)) continue
      trees.push(tree(rand, px, pz))
    }
  }
  return trees
}

// --------------------------------------------------------------------------

export function buildCity(): CityLayout {
  const rand = mulberry32(2026)
  const { roads, avenue, access, exit, intersections, turnarounds } = buildRoads()
  const lot = buildLot(rand)
  const walks: Road[] = [
    // calçadões que atravessam os jardins até a avenida, os bairros e o lago
    { kind: 'street', width: 6, points: [[18, 42 + PLAZA_D - 2], [18, avenueZ(18) - AVENUE_WIDTH / 2 - SIDEWALK]] },
    { kind: 'street', width: 6, points: smoothPath([[20, -42 - PLAZA_D + 2], [24, -190], [8, -250], [0, -296]]) },
    { kind: 'street', width: 5, points: [[62 + PLAZA_D - 2, -6], [LAKE_CENTER[0] - 54, -6]] },
    {
      kind: 'street',
      width: 4,
      closed: true,
      points: smoothPath(
        LAKE.filter((_, i) => i % 8 === 0).map(([x, z]) => {
          const [cx, cz] = LAKE_CENTER
          return [cx + (x - cx) * 1.35, cz + (z - cz) * 1.22] as Vec2
        }),
        true,
      ),
    },
  ]
  const clearance = roadIndex(roads)
  const placed = placeBuildings(rand, roads, clearance)
  const buildings = [...placed.buildings, ...placeSkyline(rand)]
  const lamps = placeLamps(roads, lot, walks, clearance)
  const trees = [...placed.trees, ...plantTrees(rand, lot, clearance, placed.buildings)]
  return {
    roads,
    avenue,
    access,
    exit,
    intersections,
    turnarounds,
    lot,
    forecourt: FORECOURT,
    buildings,
    trees,
    lamps,
    pools: placed.pools,
    porches: placed.porches,
    lake: LAKE,
    park: PARK,
    walks,
  }
}

let cached: CityLayout | null = null
export function getCity() {
  if (!cached) cached = buildCity()
  return cached
}
