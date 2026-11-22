import { mulberry32, type Random } from '../random'
import type { Vec2 } from './geometry'
import { AVENUE_WIDTH, avenueZ, type CityLayout, HALF, type ParkingLot } from './layout'

/**
 * Trânsito: cada rota vira uma trajetória cronometrada (posição, rumo e
 * velocidade a cada DT segundos), com aceleração, frenagem e redução nas
 * curvas. Os carros só percorrem essa tabela, defasados no tempo, então não
 * há simulação a cada quadro e dois carros da mesma rota nunca se encontram.
 */

export const DT = 1 / 12

const ACCEL = 2.4
const BRAKE = 3.2
const LATERAL = 2.6

export interface Leg {
  /** pontos na ordem do movimento */
  points: Vec2[]
  speed: number
  /** o carro anda de ré (fica virado para o lado oposto ao movimento) */
  reverse?: boolean
  /** segundos parado no fim do trecho */
  dwell?: number
}

export interface Track {
  /** [x, z, rumo, velocidade] por amostra */
  data: Float32Array
  samples: number
  duration: number
}

export interface MovingCar {
  track: number
  offset: number
  color: string
}

export interface ParkedCar {
  x: number
  z: number
  yaw: number
  color: string
}

export interface TrafficPlan {
  tracks: Track[]
  cars: MovingCar[]
  parked: ParkedCar[]
}

// --------------------------------------------------------------------------
// geometria das rotas

function resample(points: Vec2[], step = 1): Vec2[] {
  const out: Vec2[] = [points[0]]
  let carry = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 1e-6) continue
    let t = step - carry
    while (t < len) {
      out.push([ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len])
      t += step
    }
    carry = len - (t - step)
  }
  const last = points[points.length - 1]
  const prev = out[out.length - 1]
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > 0.05) out.push(last)
  return out
}

/** Desloca para a direita do sentido de marcha (mão de direção brasileira). */
export function rightOf(points: Vec2[], offset: number, closed = false): Vec2[] {
  const n = points.length
  return points.map((p, i) => {
    const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]
    const dx = next[0] - prev[0]
    const dz = next[1] - prev[1]
    const len = Math.hypot(dx, dz) || 1
    return [p[0] - (dz / len) * offset, p[1] + (dx / len) * offset]
  })
}

/** Arredonda as quinas (Chaikin), mantendo o primeiro e o último ponto. */
function smooth(points: Vec2[], iterations = 3, closed = false): Vec2[] {
  let pts = points
  for (let k = 0; k < iterations; k++) {
    const out: Vec2[] = closed ? [] : [pts[0]]
    const n = closed ? pts.length : pts.length - 1
    for (let i = 0; i < n; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    if (!closed) out.push(pts[pts.length - 1])
    pts = out
  }
  return pts
}

function join(...parts: Vec2[][]): Vec2[] {
  const out: Vec2[] = []
  for (const part of parts) {
    for (const p of part) {
      const last = out[out.length - 1]
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.5) out.push(p)
    }
  }
  return out
}

/** Entrada na vaga: curva da faixa do corredor até o centro da vaga. */
function stallCurve(from: Vec2, stall: Vec2): Vec2[] {
  const control: Vec2 = [from[0], stall[1]]
  const out: Vec2[] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const u = 1 - t
    out.push([
      u * u * from[0] + 2 * u * t * control[0] + t * t * stall[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * stall[1],
    ])
  }
  return out
}

// --------------------------------------------------------------------------
// trajetória cronometrada

interface TrackPoint {
  x: number
  z: number
  vmax: number
  reverse: boolean
  /** parada depois deste ponto (s); -1 = segue direto */
  dwell: number
}

export function buildTrack(legs: Leg[], closed = false): Track {
  const pts: TrackPoint[] = []
  legs.forEach((leg, li) => {
    const rs = resample(leg.points, 1)
    rs.forEach((p, i) => {
      if (li > 0 && i === 0) return
      pts.push({ x: p[0], z: p[1], vmax: leg.speed, reverse: !!leg.reverse, dwell: -1 })
    })
    const next = legs[li + 1]
    if (leg.dwell !== undefined || leg.reverse || next?.reverse) {
      const last = pts[pts.length - 1]
      last.vmax = 0
      last.dwell = leg.dwell ?? 0.8
    }
  })

  // limite de velocidade pela curvatura
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const c = pts[i + 1]
    if (a.reverse !== c.reverse) continue
    const h1 = Math.atan2(b.x - a.x, b.z - a.z)
    const h2 = Math.atan2(c.x - b.x, c.z - b.z)
    let d = Math.abs(h2 - h1)
    if (d > Math.PI) d = Math.PI * 2 - d
    const ds = Math.hypot(c.x - a.x, c.z - a.z) / 2
    if (d > 1e-3) b.vmax = Math.min(b.vmax, Math.sqrt(LATERAL * (ds / d)))
  }

  const n = pts.length
  const v = new Float32Array(n)
  const dist = (i: number) => Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
  v[0] = pts[0].vmax
  for (let i = 1; i < n; i++) v[i] = Math.min(pts[i].vmax, Math.sqrt(v[i - 1] ** 2 + 2 * ACCEL * dist(i)))
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * BRAKE * dist(i + 1)))
  if (closed) v[0] = v[n - 1] = Math.min(v[0], v[n - 1])

  // tempo em cada ponto (paradas incluídas)
  const time = new Float32Array(n)
  const leave = new Float32Array(n)
  leave[0] = pts[0].dwell > 0 ? pts[0].dwell : 0
  for (let i = 1; i < n; i++) {
    const avg = Math.max(0.35, (v[i - 1] + v[i]) / 2)
    time[i] = leave[i - 1] + dist(i) / avg
    leave[i] = time[i] + Math.max(0, pts[i].dwell)
  }
  const duration = leave[n - 1] + (closed ? Math.hypot(pts[0].x - pts[n - 1].x, pts[0].z - pts[n - 1].z) / Math.max(0.5, v[0]) : 0)

  const samples = Math.ceil(duration / DT) + 1
  const data = new Float32Array(samples * 4)
  let seg = 1
  let heading = Math.atan2(pts[1].x - pts[0].x, pts[1].z - pts[0].z) + (pts[1].reverse ? Math.PI : 0)
  for (let k = 0; k < samples; k++) {
    const t = Math.min(k * DT, leave[n - 1])
    while (seg < n - 1 && time[seg] < t) seg++
    const a = pts[seg - 1]
    const b = pts[seg]
    let x: number
    let z: number
    let speed: number
    if (t <= leave[seg - 1]) {
      // parado no ponto anterior
      x = a.x
      z = a.z
      speed = 0
    } else {
      const span = time[seg] - leave[seg - 1]
      const f = span > 0 ? Math.min(1, (t - leave[seg - 1]) / span) : 1
      x = a.x + (b.x - a.x) * f
      z = a.z + (b.z - a.z) * f
      speed = v[seg - 1] + (v[seg] - v[seg - 1]) * f
      const dx = b.x - a.x
      const dz = b.z - a.z
      if (dx * dx + dz * dz > 1e-6) heading = Math.atan2(dx, dz) + (b.reverse ? Math.PI : 0)
    }
    data.set([x, z, heading, speed], k * 4)
  }
  return { data, samples, duration }
}

/** Posição de um carro na trajetória (com interpolação suave do rumo). */
export function sampleTrack(track: Track, time: number, out: { x: number; z: number; heading: number; speed: number; braking: boolean }) {
  const t = ((time % track.duration) + track.duration) % track.duration
  const f = t / DT
  const i = Math.min(track.samples - 2, Math.floor(f))
  const u = f - i
  const d = track.data
  const a = i * 4
  const b = a + 4
  out.x = d[a] + (d[b] - d[a]) * u
  out.z = d[a + 1] + (d[b + 1] - d[a + 1]) * u
  let dh = d[b + 2] - d[a + 2]
  if (dh > Math.PI) dh -= Math.PI * 2
  if (dh < -Math.PI) dh += Math.PI * 2
  out.heading = d[a + 2] + dh * u
  out.speed = d[a + 3] + (d[b + 3] - d[a + 3]) * u
  out.braking = d[b + 3] < d[a + 3] - 0.02 || out.speed < 0.3
  return out
}

// --------------------------------------------------------------------------
// rotas da cidade

const CAR_COLORS = [
  ['#e8e8e6', 25],
  ['#a9adb3', 20],
  ['#1b1c1f', 18],
  ['#5a5e64', 15],
  ['#9e1b1b', 8],
  ['#1f3a6e', 7],
  ['#c9b79a', 4],
  ['#2e4b3a', 3],
] as const

function carColor(rand: Random) {
  let r = rand() * 100
  for (const [color, weight] of CAR_COLORS) {
    if ((r -= weight) <= 0) return color
  }
  return CAR_COLORS[0][0]
}

/** Trecho de uma linha entre dois valores de x (a linha precisa andar em x). */
function sliceByX(points: Vec2[], from: number, to: number): Vec2[] {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  return points.filter(([x]) => x >= lo && x <= hi)
}

/** faixas da avenida: as duas internas para quem segue direto, a externa para quem entra ou sai */
const THROUGH_LANES = [2, 5.6]
const TURN_LANE = 9.2
const TURN_SPEED = 12
const LOT_LANE = 1.6
const ROAD_LANE = 2.4

interface RouteKit {
  rand: Random
  add: (legs: Leg[], cars: number, closed?: boolean) => void
}

/** Divide um caminho em dois trechos com velocidades diferentes, no ponto mais próximo de `at`. */
function splitAt(points: Vec2[], at: (p: Vec2) => boolean): [Vec2[], Vec2[]] {
  const k = Math.max(1, Math.min(points.length - 2, points.findIndex(at)))
  return [points.slice(0, k + 1), points.slice(k)]
}

function avenueRoutes(city: CityLayout, { add }: RouteKit) {
  const av = city.avenue.points
  THROUGH_LANES.forEach((lane, i) => {
    const speed = 17 - i * 2
    add([{ points: rightOf(av, lane), speed }], 8 - i)
    add([{ points: rightOf([...av].reverse(), lane), speed: speed - 0.5 }], 8 - i)
  })
}

function lotRoutes(city: CityLayout, { rand, add }: RouteKit) {
  const lot = city.lot
  const av = city.avenue.points
  const westbound = rightOf([...av].reverse(), TURN_LANE)
  const accessNorth = rightOf(city.access.points, ROAD_LANE)
  const accessSouth = rightOf([...city.access.points].reverse(), ROAD_LANE)
  const exitNorth = rightOf(city.exit.points, ROAD_LANE)
  const exitSouth = rightOf([...city.exit.points].reverse(), ROAD_LANE)
  const junctionX = city.access.points[0][0]
  const offAvenue = (p: Vec2) => Math.abs(p[1] - avenueZ(p[0])) > AVENUE_WIDTH / 2 - 1
  const streetEnd: Vec2 = [-270, -HALF - 20]
  const streetNorth = rightOf([[-270, -300], streetEnd], ROAD_LANE)
  const streetSouth = rightOf([streetEnd, [-270, -300]], ROAD_LANE)

  const free = lot.stalls.filter((s) => !s.occupied)
  const pick = () => free.splice(Math.floor(rand() * free.length), 1)[0]
  const aisleOf = (x: number) => lot.aisles.reduce((best, a) => (Math.abs(a - x) < Math.abs(best - x) ? a : best), lot.aisles[0])
  /** faixa de circulação: a direita do sentido de marcha (oeste → norte, leste → sul) */
  const laneZ = (base: number, fromX: number, toX: number) => base + (toX < fromX ? -LOT_LANE : LOT_LANE)

  // Entra pela avenida, estaciona, dá ré e sai pelo norte para os bairros.
  for (let k = 0; k < 6; k++) {
    const stall = pick()
    if (!stall) break
    const laneX = aisleOf(stall.x) + LOT_LANE
    const approach: Vec2 = [laneX, stall.z + 5.5]
    const gateIn = lot.gate + ROAD_LANE
    const front = laneZ(lot.frontLane, gateIn, laneX)
    const back = laneZ(lot.backLane, laneX, lot.gate + ROAD_LANE)
    const inbound = smooth(
      join(sliceByX(westbound, HALF + 60, junctionX + 14), accessNorth.filter(offAvenue), [
        [gateIn, front],
        [laneX, front],
        approach,
      ]),
    )
    const [onAvenue, inLot] = splitAt(inbound, (p) => p[0] < junctionX + 16)
    const park = stallCurve(approach, [stall.x, stall.z])
    const outbound = smooth(
      join([approach], [[laneX, back], [lot.gate + ROAD_LANE, back]], exitNorth.filter((p) => p[1] < lot.backLane), streetNorth),
    )
    add(
      [
        { points: onAvenue, speed: TURN_SPEED },
        { points: inLot, speed: 6 },
        { points: park, speed: 2.5, dwell: 25 + rand() * 45 },
        { points: [...park].reverse(), speed: 1.8, reverse: true },
        { points: outbound, speed: 7 },
      ],
      2,
    )
  }

  // Chega pelo bairro ao norte, estaciona e sai pela via de acesso para a avenida.
  for (let k = 0; k < 4; k++) {
    const stall = pick()
    if (!stall) break
    const laneX = aisleOf(stall.x) - LOT_LANE
    const approach: Vec2 = [laneX, stall.z - 5.5]
    const gateIn = lot.gate - ROAD_LANE
    const back = laneZ(lot.backLane, gateIn, laneX)
    const front = laneZ(lot.frontLane, laneX, lot.gate - ROAD_LANE)
    const inbound = smooth(
      join(streetSouth, exitSouth.filter((p) => p[1] < lot.farZ + 2), [
        [gateIn, back],
        [laneX, back],
        approach,
      ]),
    )
    const park = stallCurve(approach, [stall.x, stall.z])
    const outbound = smooth(
      join(
        [approach],
        [
          [laneX, front],
          [lot.gate - ROAD_LANE, front],
        ],
        accessSouth.filter(offAvenue),
        sliceByX(westbound, junctionX - 6, -HALF - 60),
      ),
    )
    const [inLot, onAvenue] = splitAt(outbound, (p) => p[1] > avenueZ(p[0]) - AVENUE_WIDTH / 2 - 6)
    add(
      [
        { points: inbound, speed: 7 },
        { points: park, speed: 2.5, dwell: 30 + rand() * 50 },
        { points: [...park].reverse(), speed: 1.8, reverse: true },
        { points: inLot, speed: 6 },
        { points: onAvenue, speed: TURN_SPEED },
      ],
      2,
    )
  }
}

function neighborhoodRoutes(city: CityLayout, { rand, add }: RouteKit) {
  const key = (a: Vec2, b: Vec2) => {
    const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a]
    return `${p[0]},${p[1]}|${q[0]},${q[1]}`
  }
  const streets = city.roads.filter((r) => r.kind === 'street')
  const segments = new Set(streets.map((r) => key(r.points[0], r.points[1])))
  const xs = [...new Set(streets.flatMap((r) => r.points.map((p) => p[0])))].sort((a, b) => a - b)
  const zs = [...new Set(streets.flatMap((r) => r.points.map((p) => p[1])))].sort((a, b) => a - b)

  // quarteirões fechados (os quatro lados existem)
  const blocks: Vec2[][] = []
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const [x0, x1, z0, z1] = [xs[i], xs[i + 1], zs[j], zs[j + 1]]
      const corners: Vec2[] = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ]
      if (corners.every((c, k) => segments.has(key(c, corners[(k + 1) % 4])))) blocks.push(corners)
    }
  }
  // prioriza os quarteirões que aparecem na abertura (do outro lado da avenida)
  blocks.sort((a, b) => Math.hypot(a[0][0] + 200, a[0][1] - 380) - Math.hypot(b[0][0] + 200, b[0][1] - 380))
  for (const [c0, c1, c2, c3] of blocks.slice(0, 12)) {
    // começa no meio de um lado para a volta fechar numa reta
    const mid: Vec2 = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2]
    const loop = rightOf(smooth(resample([mid, c1, c2, c3, c0, mid], 6), 3), ROAD_LANE)
    add([{ points: loop, speed: 8 + rand() * 2 }], 2, true)
  }

  // ruas que chegam à avenida e seguem inteiras até a borda do mapa
  const av = city.avenue.points
  const eastbound = rightOf(av, TURN_LANE)
  const westbound = rightOf([...av].reverse(), TURN_LANE)
  const reachesEdge = (x: number, fromZ: number, dir: 1 | -1) => {
    let z = fromZ
    const column = zs.filter((v) => (dir > 0 ? v >= fromZ : v <= fromZ)).sort((a, b) => dir * (a - b))
    for (let i = 0; i < column.length - 1; i++) {
      if (!segments.has(key([x, column[i]], [x, column[i + 1]]))) return false
      z = column[i + 1]
    }
    return Math.abs(z) > HALF - 20
  }
  let used = 0
  for (const road of streets) {
    if (used >= 8) break
    const [a, b] = road.points
    if (a[0] !== b[0]) continue
    const x = a[0]
    const az = avenueZ(x)
    const touches = [a, b].find((p) => Math.abs(p[1] - az) < AVENUE_WIDTH)
    const grid = [a, b].find((p) => p !== touches)
    if (!touches || !grid) continue
    const south = grid[1] > az
    const dir = south ? 1 : -1
    if (!reachesEdge(x, grid[1], dir)) continue
    used++
    const edge: Vec2 = [x, dir * (HALF + 20)]
    const turnOff = rightOf([[x, az], edge], ROAD_LANE).filter((p) => Math.abs(p[1] - avenueZ(p[0])) > AVENUE_WIDTH / 2 - 1)
    const turnOn = rightOf([edge, [x, az]], ROAD_LANE).filter((p) => Math.abs(p[1] - avenueZ(p[0])) > AVENUE_WIDTH / 2 - 1)
    // ao sul: vem para leste e vira à direita; ao norte: vem para oeste e vira à direita
    const approach = south ? sliceByX(eastbound, -HALF - 60, x - 8) : sliceByX(westbound, HALF + 60, x + 8)
    const leave = south ? sliceByX(eastbound, x + 8, HALF + 60) : sliceByX(westbound, x - 8, -HALF - 60)
    if (approach.length > 2) add([{ points: smooth(join(approach, resample(turnOff, 8))), speed: TURN_SPEED }], 1)
    if (leave.length > 2) add([{ points: smooth(join(resample(turnOn, 8), leave)), speed: TURN_SPEED }], 1)
  }
}

/** Separa o caminho em: trecho na avenida, trecho fora dela e (se houver) volta para a avenida. */
function splitByAvenue(points: Vec2[]): Vec2[][] {
  const off = (p: Vec2) => Math.abs(p[1] - avenueZ(p[0])) > AVENUE_WIDTH / 2 + 1
  const first = points.findIndex(off)
  let last = -1
  for (let i = points.length - 1; i >= 0; i--) {
    if (off(points[i])) {
      last = i
      break
    }
  }
  if (first <= 0 || last < 0) return [points]
  const parts = [points.slice(0, first + 1), points.slice(first, last + 1)]
  if (last < points.length - 1) parts.push(points.slice(last))
  return parts
}

function villageRoutes(city: CityLayout, { add }: RouteKit) {
  const av = city.avenue.points
  const westbound = rightOf([...av].reverse(), TURN_LANE)
  const offAvenue = (p: Vec2) => Math.abs(p[1] - avenueZ(p[0])) > AVENUE_WIDTH / 2 - 1

  // "U" a sudeste: entra pela avenida em x = 215, contorna e volta em x = 125
  const loop = rightOf(
    resample(
      [
        [215, avenueZ(215)],
        [215, 150],
        [125, 150],
        [125, avenueZ(125)],
      ],
      6,
    ),
    ROAD_LANE,
  ).filter(offAvenue)
  const uRoute = smooth(join(sliceByX(westbound, HALF + 60, 223), loop, sliceByX(westbound, 117, -HALF - 60)))
  const [inA, village, outA] = splitByAvenue(uRoute)
  if (village && outA) {
    add(
      [
        { points: inA, speed: TURN_SPEED },
        { points: village, speed: 7 },
        { points: outA, speed: TURN_SPEED },
      ],
      2,
    )
  }

  // rua sem saída a nordeste: desce pela x = 270, contorna o retorno e sobe de volta
  const t = city.turnarounds[0]
  if (!t) return
  const down = rightOf(resample([[270, -HALF - 20], [270, -155], [t.x + 2, t.z]], 6), ROAD_LANE)
  const turn: Vec2[] = []
  const radius = t.r - 2.4
  for (let a = -Math.PI / 2; a >= -Math.PI * 2.15; a -= 0.2) turn.push([t.x + Math.cos(a) * radius, t.z + Math.sin(a) * radius])
  const up = rightOf(resample([[t.x + 2, t.z], [270, -155], [270, -HALF - 20]], 6), ROAD_LANE)
  add([{ points: smooth(join(down.slice(0, -1), turn, up.slice(1))), speed: 7 }], 1)
}

function parkedCars(lot: ParkingLot, rand: Random): ParkedCar[] {
  return lot.stalls.filter((s) => s.occupied).map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, color: carColor(rand) }))
}

export function buildTraffic(city: CityLayout): TrafficPlan {
  const rand = mulberry32(911)
  const tracks: Track[] = []
  const cars: MovingCar[] = []
  const kit: RouteKit = {
    rand,
    add: (legs, count, closed = false) => {
      const track = buildTrack(legs, closed)
      const index = tracks.push(track) - 1
      for (let k = 0; k < count; k++) {
        const jitter = (rand() - 0.5) * 0.12
        cars.push({ track: index, offset: track.duration * ((k + 0.5 + jitter) / count), color: carColor(rand) })
      }
    },
  }
  avenueRoutes(city, kit)
  lotRoutes(city, kit)
  neighborhoodRoutes(city, kit)
  villageRoutes(city, kit)
  return { tracks, cars, parked: parkedCars(city.lot, rand) }
}
