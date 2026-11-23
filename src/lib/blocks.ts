import { frameAt, SEGMENTS, segmentLength, STAND_NAMES } from './bowl'
import { getLayout, type Block } from './layout'

/** Informações de cada bloco para a interface e para a câmera. */
export interface BlockInfo {
  block: Block
  /** preço do ingresso (R$) */
  price: number
  standName: string
  tierName: string
  /** como é a vista do campo a partir do bloco */
  view: string
  /** altura em relação ao gramado */
  heightNote: string
  /** centro das fileiras do bloco (mundo) */
  center: [number, number, number]
  /** ponto logo acima do fundo do bloco, onde fica o rótulo */
  labelAt: [number, number, number]
  /** direção horizontal do campo para a arquibancada, no centro do bloco */
  normal: [number, number]
  /** largura (na fileira do meio) e altura do bloco, em metros */
  width: number
  height: number
}

const TIER_NAMES = { lower: 'Anel inferior', middle: 'Anel intermediário', upper: 'Anel superior' }

// Preço-base por anel. O bloco central da arquibancada norte do anel
// intermediário (232) é o mais caro; laterais e cantos custam menos.
const BASE_PRICE = { lower: 890, middle: 1250, upper: 420 }

function priceOf(block: Block) {
  const seg = SEGMENTS[block.segment]
  const mid = (block.s0 + block.s1) / 2
  let factor: number
  if (seg.kind === 'arc') factor = 0.72
  else if (seg.long) factor = 1 - Math.abs(mid - 0.5) * 0.5
  else factor = 0.62 * (1 - Math.abs(mid - 0.5) * 0.3)
  return Math.round((BASE_PRICE[block.tier] * factor) / 10) * 10
}

const HEIGHT_NOTES = { lower: 'Perto do gramado', middle: 'Altura ideal', upper: 'Vista do alto' }

function viewOf(block: Block) {
  const seg = SEGMENTS[block.segment]
  const mid = (block.s0 + block.s1) / 2
  if (seg.kind === 'arc') return 'Vista diagonal'
  if (!seg.long) return 'Atrás do gol'
  return Math.abs(mid - 0.5) < 0.2 ? 'Meio-campo' : 'Vista lateral'
}

function buildInfo(block: Block): BlockInfo {
  const { tiers } = getLayout()
  const tier = tiers.find((t) => t.spec.id === block.tier)!
  const seg = SEGMENTS[block.segment]
  const midRow = tier.rows[Math.floor(tier.rows.length / 2)]
  const lastRow = tier.rows[tier.rows.length - 1]
  const sMid = (block.s0 + block.s1) / 2
  const dMid = midRow.d + tier.spec.rowDepth / 2
  const center = frameAt(seg, sMid, dMid)
  const back = frameAt(seg, sMid, tier.back - 1)
  return {
    block,
    price: priceOf(block),
    standName: `Arquibancada ${STAND_NAMES[block.stand]}`,
    tierName: TIER_NAMES[block.tier],
    view: viewOf(block),
    heightNote: HEIGHT_NOTES[block.tier],
    center: [center.x, midRow.y + 0.5, center.z],
    labelAt: [back.x, lastRow.y + 2.6, back.z],
    normal: [center.nx, center.nz],
    width: (block.s1 - block.s0) * segmentLength(seg, dMid),
    height: lastRow.y - tier.rows[0].y + 1.5,
  }
}

let cache: BlockInfo[] | null = null

export function getBlockInfo(index: number): BlockInfo {
  if (!cache) cache = getLayout().blocks.map(buildInfo)
  return cache[index]
}

/** Posição (mundo) de uma cadeira, na altura do assento. */
export function seatPosition(seat: number): [number, number, number] {
  const { seats } = getLayout()
  return [seats.position[seat * 3], seats.position[seat * 3 + 1] + 0.5, seats.position[seat * 3 + 2]]
}

export function seatLabel(seat: number) {
  const { seats } = getLayout()
  return { row: seats.row[seat], number: seats.number[seat], taken: seats.taken[seat] === 1 }
}

export const formatPrice = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
