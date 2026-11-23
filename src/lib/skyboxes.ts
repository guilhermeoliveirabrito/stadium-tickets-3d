import { SKYBOX } from '../config/stadium'
import { frameAt, SEGMENTS, STAND_NAMES } from './bowl'
import { once } from './once'
import { mulberry32 } from './random'

/** Laterais com camarotes (norte e sul); o resto do anel recebe uma parede de serviço. */
export const SKYBOX_SEGMENTS = [0, 4]

export interface SkyboxInfo {
  /** índice (0 a 23), no sentido horário a partir da ponta oeste da lateral norte */
  index: number
  /** número exibido ("01" a "24") */
  number: string
  segment: number
  /** posição do centro ao longo do segmento (0 a 1) */
  center: number
  standName: string
  /** valor do camarote inteiro (R$) */
  price: number
  capacity: number
  sold: boolean
  view: string
  /** centro do camarote (mundo), na metade da profundidade e da altura */
  position: [number, number, number]
  /** direção horizontal do campo para o camarote */
  normal: [number, number]
}

export const SKYBOX_AMENITIES = [
  'Open bar e buffet',
  'Ar-condicionado',
  'Banheiro privativo',
  'TVs com replays',
  '4 vagas no estacionamento VIP',
]

/** Meia largura da faixa de camarotes ao longo de x (as laterais maiores são retas em x). */
export const SKYBOX_HALF_SPAN = (SEGMENTS[0].kind === 'line' ? SEGMENTS[0].length : 0) / 2

export const getSkyboxes = once((): SkyboxInfo[] => {
  const out: SkyboxInfo[] = []
  const rand = mulberry32(2026)
  for (const segment of SKYBOX_SEGMENTS) {
    const seg = SEGMENTS[segment]
    if (seg.kind !== 'line') continue
    const count = Math.round(seg.length / SKYBOX.width)
    for (let k = 0; k < count; k++) {
      const center = (k + 0.5) / count
      // os do meio-campo custam mais
      const central = 1 - Math.abs(center - 0.5) * 2
      const f = frameAt(seg, center, (SKYBOX.front + SKYBOX.back) / 2)
      const index = out.length
      out.push({
        index,
        number: String(index + 1).padStart(2, '0'),
        segment,
        center,
        standName: `Arquibancada ${STAND_NAMES[seg.stand]}`,
        price: Math.round((22000 + 14000 * central) / 500) * 500,
        capacity: SKYBOX.rows.length * SKYBOX.chairsPerRow,
        sold: rand() < 0.38,
        view: central > 0.55 ? 'Vista central' : 'Vista lateral',
        position: [f.x, (SKYBOX.floor + SKYBOX.ceiling) / 2, f.z],
        normal: [f.nx, f.nz],
      })
    }
  }
  return out
})

/** Camarote livre mais perto do meio-campo (entrada pela visão geral). */
export function bestAvailableSkybox() {
  const free = getSkyboxes().filter((b) => !b.sold)
  free.sort((a, b) => Math.abs(a.center - 0.5) - Math.abs(b.center - 0.5) || a.index - b.index)
  return free[0]?.index ?? 0
}

/**
 * Índice do camarote num ponto (x, z) do mundo, a mesma conta feita nos
 * shaders: as laterais norte (z < 0) e sul são retas ao longo de x.
 */
export const SKYBOX_INDEX_GLSL = /* glsl */ `
float skyboxIndexAt(vec3 p) {
  float span = ${SKYBOX_HALF_SPAN.toFixed(3)};
  if (abs(p.x) > span) return -1.0;
  float k = floor((p.z < 0.0 ? p.x + span : span - p.x) / ${SKYBOX.width.toFixed(3)});
  return min(k, ${(Math.round((2 * SKYBOX_HALF_SPAN) / SKYBOX.width) - 1).toFixed(1)}) + (p.z < 0.0 ? 0.0 : ${Math.round((2 * SKYBOX_HALF_SPAN) / SKYBOX.width).toFixed(1)});
}
`

export const formatSkybox = (info: SkyboxInfo) => `Camarote ${info.number}`
