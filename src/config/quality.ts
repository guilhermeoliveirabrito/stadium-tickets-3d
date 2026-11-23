/**
 * Níveis de qualidade. O nível inicial vem do aparelho (celular, memória,
 * núcleos) e depois sobe ou desce conforme o FPS medido. `?q=low|medium|high`
 * força um nível.
 */
export type Tier = 'low' | 'medium' | 'high'
export const TIER_ORDER: Tier[] = ['low', 'medium', 'high']

interface Quality {
  /** orçamento de pixels do canvas (a resolução se ajusta ao tamanho da janela) */
  pixels: number
  /** resolução mínima, mesmo estourando o orçamento */
  minDpr: number
  msaa: number
  smaa: boolean
  ao: boolean
  bloomLevels: number
}

const nav = navigator as Navigator & { deviceMemory?: number }
export const IS_MOBILE =
  /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) ||
  (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent)) ||
  window.matchMedia('(pointer: coarse)').matches

export const QUALITY: Record<Tier, Quality> = {
  // No PC o nível baixo fica na resolução nativa, com MSAA 2x: renderizar
  // abaixo de 1x e esticar (o que acontecia em telas Full HD) deixava o
  // serrilhado em blocos maiores. No celular a tela densa já esconde boa
  // parte do serrilhado, então vale o SMAA, mais barato.
  low: IS_MOBILE
    ? { pixels: 1.1e6, minDpr: 0.75, msaa: 0, smaa: true, ao: false, bloomLevels: 5 }
    : { pixels: 1.1e6, minDpr: 1, msaa: 2, smaa: false, ao: false, bloomLevels: 5 },
  medium: { pixels: 2.1e6, minDpr: 1, msaa: 4, smaa: false, ao: false, bloomLevels: 7 },
  high: { pixels: 3.2e6, minDpr: 1, msaa: 4, smaa: false, ao: true, bloomLevels: 8 },
}

const forced = new URLSearchParams(window.location.search).get('q') as Tier | null
const weak = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4

export const START_TIER: Tier = forced && TIER_ORDER.includes(forced) ? forced : IS_MOBILE || weak ? 'low' : 'medium'
export const MAX_TIER: Tier = forced ?? (IS_MOBILE ? 'medium' : 'high')
export const TIER_LOCKED = !!forced

/** Recursos decididos na carga (texturas e multidão não mudam depois). */
const lite = START_TIER === 'low'
export const GROUND_TEXTURE_SIZE = lite ? 2048 : 4096
export const LIGHT_MAP_SIZE = lite ? 1024 : 2048
export const CROWD_DENSITY = lite ? 0.5 : 1

/** Resolução do canvas para caber no orçamento de pixels do nível. */
export function pixelRatioFor(tier: Tier, width: number, height: number) {
  const q = QUALITY[tier]
  const budget = Math.sqrt(q.pixels / Math.max(1, width * height))
  return Math.min(window.devicePixelRatio || 1, Math.max(q.minDpr, budget))
}
