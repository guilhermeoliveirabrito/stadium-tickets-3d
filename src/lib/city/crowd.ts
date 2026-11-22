import { SEGMENTS, frameAt } from '../bowl'
import { mulberry32, type Random } from '../random'
import type { Vec2 } from './geometry'
import { roundedLoop } from './geometry'
import { AVENUE_WIDTH, avenueZ, type CityLayout, PLAZA_D, SIDEWALK } from './layout'

/**
 * Pedestres: cada pessoa recebe um caminho, uma velocidade e uma defasagem.
 * Os caminhos ficam numa textura (pontos igualmente espaçados) e a posição é
 * calculada no shader, então não há custo por pessoa no processador.
 */

export const PATH_SAMPLES = 256

export interface CrowdPlan {
  /** PATH_SAMPLES x paths, RGBA: x, z, 0, 0 */
  paths: Float32Array
  pathCount: number
  count: number
  /** caminho, defasagem (m), velocidade (m/s, sinal = sentido), comprimento (m) */
  walk: Float32Array
  /** deslocamento lateral, escala de altura, modo (0 volta, 1 vai e volta), semente */
  look: Float32Array
  shirt: Float32Array
}

interface PathSpec {
  points: Vec2[]
  closed: boolean
  people: number
  /** largura da faixa por onde as pessoas se espalham */
  spread: number
}

function resampleEven(points: Vec2[], closed: boolean, samples: number) {
  const pts = closed ? [...points, points[0]] : points
  const cumulative = [0]
  for (let i = 1; i < pts.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  const length = cumulative[cumulative.length - 1]
  const out: Vec2[] = []
  let seg = 1
  for (let k = 0; k < samples; k++) {
    const s = (k / (samples - 1)) * length
    while (seg < pts.length - 1 && cumulative[seg] < s) seg++
    const span = cumulative[seg] - cumulative[seg - 1] || 1
    const t = (s - cumulative[seg - 1]) / span
    out.push([
      pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * t,
      pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * t,
    ])
  }
  return { out, length }
}

// torcida: maioria com as cores dos dois times, o resto em tons neutros
const SHIRTS: [string, number][] = [
  ['#c8102e', 30],
  ['#e23b3b', 8],
  ['#1f45c7', 18],
  ['#f2f2f0', 14],
  ['#1a1a1d', 12],
  ['#5d6168', 8],
  ['#e0b23a', 4],
  ['#2f7a4a', 3],
  ['#8a5a3b', 3],
]

function shirt(rand: Random): [number, number, number] {
  let r = rand() * 100
  for (const [hex, weight] of SHIRTS) {
    if ((r -= weight) <= 0) return hexToLinear(hex)
  }
  return hexToLinear(SHIRTS[0][0])
}

function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const toLinear = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return [toLinear((n >> 16) & 255), toLinear((n >> 8) & 255), toLinear(n & 255)]
}

function pathSpecs(city: CityLayout, rand: Random): PathSpec[] {
  const specs: PathSpec[] = []

  // voltas pela esplanada, em vários raios
  for (const d of [60.5, 64, 68, 72, 76, 80, 83.5]) {
    specs.push({ points: roundedLoop(d, 2), closed: true, people: 300, spread: 1.6 })
  }

  // chegando e saindo pelos portões (raios da fachada até a borda da esplanada)
  SEGMENTS.forEach((seg) => {
    const gates = seg.kind === 'line' ? (seg.long ? 4 : 2) : 2
    for (let g = 0; g < gates; g++) {
      const s = (g + 0.5) / gates + (rand() - 0.5) * 0.08
      const line: Vec2[] = []
      for (let d = 58.5; d <= PLAZA_D - 1; d += 3) {
        const f = frameAt(seg, s, d)
        line.push([f.x, f.z])
      }
      specs.push({ points: line, closed: false, people: 16, spread: 1.8 })
    }
  })

  // do estacionamento até a esplanada, pelas passarelas e pelo pátio
  const lot = city.lot
  for (const z of [-90, -30, 30, 90]) {
    specs.push({
      points: [
        [lot.x1 - 70, z],
        [lot.x1, z],
        [city.forecourt.x1 - 10, z * 0.75],
        // termina na fachada, junto aos portões do lado oeste
        [-62 - 61, z * 0.5],
      ],
      closed: false,
      people: 70,
      spread: 2.6,
    })
  }
  // gente saindo do carro e andando pelos corredores
  for (const x of lot.aisles.filter((_, i) => i % 2 === 1)) {
    specs.push({
      points: [
        [x - 1.5, lot.z0 + 10],
        [x - 1.5, lot.z1 - 10],
      ],
      closed: false,
      people: 14,
      spread: 1.4,
    })
  }

  // calçadões e o caminho do lago
  for (const walk of city.walks) {
    specs.push({ points: walk.points, closed: !!walk.closed, people: walk.closed ? 50 : 40, spread: walk.width * 0.35 })
  }

  // calçadas da avenida, dos dois lados
  for (const side of [-1, 1]) {
    const line: Vec2[] = []
    for (let x = -520; x <= 420; x += 10) line.push([x, avenueZ(x) + side * (AVENUE_WIDTH / 2 + SIDEWALK / 2)])
    specs.push({ points: line, closed: false, people: 70, spread: 0.6 })
  }

  // calçadas das vilinhas
  for (const road of city.roads.filter((r) => r.village)) {
    const [a, b] = road.points
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const nx = -(b[1] - a[1]) / len
    const nz = (b[0] - a[0]) / len
    const off = road.width / 2 + SIDEWALK / 2
    specs.push({
      points: [
        [a[0] + nx * off, a[1] + nz * off],
        [b[0] + nx * off, b[1] + nz * off],
      ],
      closed: false,
      people: 4,
      spread: 0.5,
    })
  }
  return specs
}

export function buildCrowd(city: CityLayout, density = 1): CrowdPlan {
  const rand = mulberry32(1974)
  const specs = pathSpecs(city, rand).map((spec) => ({ ...spec, people: Math.max(1, Math.round(spec.people * density)) }))
  const pathCount = specs.length
  const paths = new Float32Array(PATH_SAMPLES * pathCount * 4)
  const count = specs.reduce((n, s) => n + s.people, 0)
  const walk = new Float32Array(count * 4)
  const look = new Float32Array(count * 4)
  const shirts = new Float32Array(count * 3)

  let person = 0
  specs.forEach((spec, row) => {
    const { out, length } = resampleEven(spec.points, spec.closed, PATH_SAMPLES)
    out.forEach(([x, z], k) => paths.set([x, z, 0, 0], (row * PATH_SAMPLES + k) * 4))
    for (let p = 0; p < spec.people; p++) {
      const speed = (1.0 + rand() * 0.6) * (rand() < 0.5 ? -1 : 1)
      walk.set([row, rand() * length * 2, speed, length], person * 4)
      look.set([(rand() - 0.5) * 2 * spec.spread, 0.92 + rand() * 0.16, spec.closed ? 0 : 1, rand()], person * 4)
      shirts.set(shirt(rand), person * 3)
      person++
    }
  })
  return { paths, pathCount, count, walk, look, shirt: shirts }
}
