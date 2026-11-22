// Medidas em metros. Eixo X = comprimento do campo, Z = largura, norte em -Z.

export const PITCH = {
  halfLength: 52.5,
  halfWidth: 34,
  goalHalfWidth: 3.66,
  goalHeight: 2.44,
}

// Contorno da primeira fileira do anel inferior (retângulo de cantos arredondados).
// Todas as fileiras são curvas paralelas a ele, deslocadas por uma distância d.
export const BOWL = {
  halfX: 62,
  halfZ: 42,
  radius: 14,
}

export type TierId = 'lower' | 'middle' | 'upper'

export interface TierSpec {
  id: TierId
  level: 1 | 2 | 3
  name: string
  /** distância d da face frontal (guarda-corpo) */
  front: number
  /** altura da base da face frontal */
  under: number
  /** piso da primeira fileira */
  firstRow: number
  /** altura do guarda-corpo acima da primeira fileira */
  parapet: number
  rows: number
  rowDepth: number
  /** altura do degrau na primeira e na última fileira */
  rise: [number, number]
  /** topo da parede atrás da última fileira */
  backTop: number | null
  /** base da parede de trás */
  backBottom: number
  /** contorno inferior (d, y) da parede de trás até a frente */
  underside: [number, number][]
  /** blocos por lateral maior, lateral menor e canto */
  blocks: { long: number; short: number; corner: number }
  fascia: string
}

export const TIERS: TierSpec[] = [
  {
    id: 'lower',
    level: 1,
    name: 'Anel inferior',
    front: 0,
    under: 0,
    firstRow: 1.2,
    parapet: 1.0,
    rows: 24,
    rowDepth: 0.82,
    rise: [0.3, 0.46],
    backTop: 11.0,
    backBottom: 0,
    underside: [],
    blocks: { long: 7, short: 4, corner: 4 },
    fascia: '#2a2e35',
  },
  {
    id: 'middle',
    level: 2,
    name: 'Anel intermediário',
    front: 20.4,
    under: 15.2,
    firstRow: 16.2,
    parapet: 1.0,
    rows: 15,
    rowDepth: 0.85,
    rise: [0.5, 0.58],
    backTop: 27.0,
    backBottom: 15.2,
    underside: [],
    blocks: { long: 7, short: 4, corner: 5 },
    fascia: '#1f3fb2',
  },
  {
    id: 'upper',
    level: 3,
    name: 'Anel superior',
    front: 30.5,
    under: 27.0,
    firstRow: 28.4,
    parapet: 1.1,
    rows: 22,
    rowDepth: 0.86,
    rise: [0.6, 0.7],
    backTop: null,
    backBottom: 33,
    underside: [[34.5, 27.0]],
    blocks: { long: 7, short: 4, corner: 7 },
    fascia: '#1f3fb2',
  },
]

export const PARAPET_THICKNESS = 0.3
export const BACK_WALL_THICKNESS = 0.3
export const AISLE_WIDTH = 1.1

export const SEAT = {
  pitch: 0.5,
  width: 0.44,
  /** recuo da origem da cadeira em relação ao espelho do degrau */
  setback: 0.34,
  margin: 0.06,
}

export const SKYBOX = {
  front: 20.6,
  floor: 11.0,
  ceiling: 15.2,
  back: 27.6,
  width: 8,
  /** fileiras de poltronas: [d, altura do piso] */
  rows: [
    [21.3, 11.0],
    [22.5, 11.35],
    [23.7, 11.7],
  ] as [number, number][],
  chairsPerRow: 9,
}

export const ROOF = {
  inner: 42,
  outer: 57.5,
  innerY: 50.4,
  outerY: 47.8,
  thickness: 1.5,
}

export const FACADE = {
  wall: 52.2,
  fins: 54.6,
  top: 47.4,
}
