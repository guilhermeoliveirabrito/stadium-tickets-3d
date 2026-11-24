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
  /** quantas cadeiras perto da câmera podem usar o modelo detalhado */
  detailSeats: number
}

const nav = navigator as Navigator & { deviceMemory?: number }
export const IS_MOBILE =
  /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) ||
  (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent)) ||
  window.matchMedia('(pointer: coarse)').matches

export const QUALITY: Record<Tier, Quality> = {
  // No PC o nível baixo fica na resolução nativa: renderizar abaixo de 1x e
  // esticar (o que acontecia em telas Full HD) deixava o serrilhado em blocos
  // maiores. O antisserrilhado é o SMAA, bem mais leve que o MSAA; o que
  // cintilava de longe (cadeiras, carros, lâmpadas) já é estável sem MSAA.
  low: {
    pixels: 1.1e6,
    minDpr: IS_MOBILE ? 0.75 : 1,
    msaa: 0,
    smaa: true,
    ao: false,
    bloomLevels: 5,
    detailSeats: IS_MOBILE ? 1500 : 2200,
  },
  medium: { pixels: 2.1e6, minDpr: 1, msaa: 4, smaa: false, ao: false, bloomLevels: 7, detailSeats: 4600 },
  high: { pixels: 3.2e6, minDpr: 1, msaa: 4, smaa: false, ao: true, bloomLevels: 8, detailSeats: 7600 },
}

/**
 * O navegador abre WebGL 2 (o three.js precisa dele)? E o nome da placa de
 * vídeo, quando o navegador informa.
 */
function probeGpu() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return { webgl2: false, name: '' }
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { webgl2: true, name }
  } catch {
    return { webgl2: false, name: '' }
  }
}

const probe = probeGpu()
export const HAS_WEBGL2 = probe.webgl2
export const GPU = probe.name

/**
 * Placa integrada (Intel, AMD integrada, celulares, renderização por software).
 * Esses aparelhos já começam no nível baixo: descer de nível no meio da
 * abertura recria o pós-processamento e dá um engasgo.
 */
const INTEGRATED =
  /Intel|Iris|UHD Graphics|HD Graphics|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d|llvmpipe|SwiftShader|Mali|Adreno|PowerVR/i.test(
    GPU,
  ) && !/\bArc\b/i.test(GPU)

const asked = new URLSearchParams(window.location.search).get('q')
const forced = TIER_ORDER.find((tier) => tier === asked) ?? null
const lowMemory = (nav.deviceMemory ?? 8) <= 4
const weak = lowMemory || (nav.hardwareConcurrency ?? 8) <= 4

export const START_TIER: Tier = forced ?? (IS_MOBILE || weak || INTEGRATED ? 'low' : 'medium')
export const MAX_TIER: Tier = forced ?? (IS_MOBILE ? 'medium' : 'high')
export const TIER_LOCKED = !!forced

/**
 * Recursos decididos na carga (texturas e multidão não mudam depois). No PC as
 * texturas do chão ficam na resolução cheia mesmo no nível baixo: a imagem é
 * nativa e o chão de baixa resolução ficava borrado.
 */
const lite = IS_MOBILE || lowMemory
export const GROUND_TEXTURE_SIZE = lite ? 2048 : 4096
export const LIGHT_MAP_SIZE = lite ? 1024 : 2048
export const CROWD_DENSITY = lite ? 0.5 : 1

/** Resolução do canvas para caber no orçamento de pixels do nível. */
export function pixelRatioFor(tier: Tier, width: number, height: number) {
  const q = QUALITY[tier]
  const budget = Math.sqrt(q.pixels / Math.max(1, width * height))
  return Math.min(window.devicePixelRatio || 1, Math.max(q.minDpr, budget))
}
