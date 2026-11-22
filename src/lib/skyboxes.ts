import { SKYBOX } from '../config/stadium'
import { SEGMENTS } from './bowl'

/** Laterais com camarotes (norte e sul); o resto do anel recebe uma parede de serviço. */
export const SKYBOX_SEGMENTS = [0, 4]

export interface SkyboxInfo {
  id: number
  segment: number
  center: number
}

export function getSkyboxes(): SkyboxInfo[] {
  const out: SkyboxInfo[] = []
  for (const segment of SKYBOX_SEGMENTS) {
    const seg = SEGMENTS[segment]
    if (seg.kind !== 'line') continue
    const count = Math.round(seg.length / SKYBOX.width)
    for (let k = 0; k < count; k++) out.push({ id: out.length + 1, segment, center: (k + 0.5) / count })
  }
  return out
}
