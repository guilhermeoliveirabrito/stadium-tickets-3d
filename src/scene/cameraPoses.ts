import { MathUtils } from 'three'
import type { BlockInfo } from '../lib/blocks'

export interface Pose {
  az: number
  el: number
  dist: number
  tx: number
  ty: number
  tz: number
  fov: number
  /**
   * Desloca a imagem para cima (fração da altura da tela), sem mexer na
   * câmera. No celular em pé, o painel cobre a parte de baixo da tela e o
   * bloco precisa ficar centrado no espaço que sobra.
   */
  shift: number
  /**
   * 0 = vista de fora; 1 = câmera dentro do estádio (setor e bloco). Anda
   * junto com a câmera e fecha a neblina sobre a cidade (ver CameraRig).
   */
  inside: number
}

// Começa sobre o bairro do outro lado da avenida, com o estacionamento em
// primeiro plano e o skyline atrás do estádio, e contorna pelo sul.
export const INTRO_START: Pose = { az: -0.78, el: 0.1, dist: 480, tx: -30, ty: 22, tz: 0, fov: 40, shift: 0, inside: 0 }
export const INTRO_SWEEP: Partial<Pose> = { az: 0.45, el: 0.28, dist: 360, tx: -20, ty: 8 }

const emptyPose = (): Pose => ({ az: 0, el: 0, dist: 0, tx: 0, ty: 0, tz: 0, fov: 0, shift: 0, inside: 0 })

/** Tela estreita (celular em pé): o painel ocupa a parte de baixo. */
const isNarrow = (aspect: number) => aspect < 0.9
const NARROW_SHIFT = 0.2

/** Vista de cima, enquadrando o estádio e um pouco do parque em qualquer proporção de tela. */
/** `out` permite reaproveitar o mesmo objeto a cada quadro, sem gerar lixo para o coletor. */
export function aerialPose(aspect: number, out: Pose = emptyPose()): Pose {
  const fov = 32
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  // em telas largas a câmera vai um pouco para oeste, para o estacionamento
  // aparecer ao lado do estádio; em telas estreitas fica centrada no estádio
  const shift = Math.min(1, Math.max(0, (aspect - 0.8) / 0.4))
  out.az = 0
  out.el = 1.37
  out.dist = Math.max(202 / t, 160 / (t * aspect))
  out.tx = -46 * shift
  out.ty = 0
  out.tz = 16
  out.fov = fov
  out.shift = 0
  out.inside = 0
  return out
}

/** Ângulo (az) de quem olha do campo para o bloco: a câmera fica atrás do campo, de frente para a arquibancada. */
function facing(info: BlockInfo) {
  const [nx, nz] = info.normal
  return Math.atan2(-nx, -nz)
}

/**
 * Setor escolhido: a câmera desce sobre o campo e olha para a arquibancada de
 * cima, com o bloco no centro, os vizinhos dos lados e a beira do gramado.
 */
export function sectorPose(info: BlockInfo, aspect: number, out: Pose = emptyPose()): Pose {
  const fov = 36
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  const [x, y, z] = info.center
  // uns oito blocos de largura e a altura da arquibancada inteira, com folga
  const span = Math.max(info.width * 8, 100)
  out.az = facing(info)
  out.el = 0.42
  out.dist = MathUtils.clamp(Math.max(span / 2 / (t * aspect), 46 / t), 110, 240)
  out.tx = x
  out.ty = y * 0.6
  out.tz = z
  out.fov = fov
  out.shift = isNarrow(aspect) ? NARROW_SHIFT : 0
  out.inside = 1
  return out
}

/**
 * Vista de frente do bloco, quase na altura das fileiras do meio, para
 * escolher a cadeira. O bloco ocupa a maior parte da tela.
 */
export function blockPose(info: BlockInfo, aspect: number, out: Pose = emptyPose()): Pose {
  const fov = 34
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  const [x, y, z] = info.center
  // no celular em pé o bloco ocupa quase toda a largura e fica no espaço acima do painel
  const narrow = isNarrow(aspect)
  const fitWidth = (info.width * (narrow ? 1.08 : 1.28)) / 2 / (t * aspect)
  const fitHeight = (info.height * (narrow ? 2.6 : 1.7)) / 2 / t
  out.az = facing(info)
  out.el = 0.24
  out.dist = Math.max(fitWidth, fitHeight, 18)
  out.tx = x
  out.ty = y - info.height * 0.02
  out.tz = z
  out.fov = fov
  out.shift = narrow ? NARROW_SHIFT : 0
  out.inside = 1
  return out
}
