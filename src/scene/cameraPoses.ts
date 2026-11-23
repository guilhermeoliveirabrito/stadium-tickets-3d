import { MathUtils } from 'three'

export interface Pose {
  az: number
  el: number
  dist: number
  tx: number
  ty: number
  tz: number
  fov: number
}

// Começa sobre o bairro do outro lado da avenida, com o estacionamento em
// primeiro plano e o skyline atrás do estádio, e contorna pelo sul.
export const INTRO_START: Pose = { az: -0.78, el: 0.1, dist: 480, tx: -30, ty: 22, tz: 0, fov: 40 }
export const INTRO_SWEEP: Partial<Pose> = { az: 0.45, el: 0.28, dist: 360, tx: -20, ty: 8 }

/** Vista de cima, enquadrando o estádio e um pouco do parque em qualquer proporção de tela. */
/** `out` permite reaproveitar o mesmo objeto a cada quadro, sem gerar lixo para o coletor. */
export function aerialPose(aspect: number, out: Pose = { az: 0, el: 0, dist: 0, tx: 0, ty: 0, tz: 0, fov: 0 }): Pose {
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
  return out
}
