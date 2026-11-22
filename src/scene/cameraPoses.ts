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

// começa a oeste-sudoeste, com a fachada iluminada, e contorna pelo sul
export const INTRO_START: Pose = { az: -1.05, el: 0.085, dist: 400, tx: 0, ty: 22, tz: 0, fov: 40 }
export const INTRO_SWEEP: Partial<Pose> = { az: 0.55, el: 0.27, dist: 340, ty: 8 }

/** Vista de cima, enquadrando o estádio e um pouco do parque em qualquer proporção de tela. */
export function aerialPose(aspect: number): Pose {
  const fov = 32
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  const dist = Math.max(172 / t, 150 / (t * aspect))
  return { az: 0, el: 1.37, dist, tx: 0, ty: 0, tz: 14, fov }
}
