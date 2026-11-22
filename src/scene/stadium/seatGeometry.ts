import { BoxGeometry, BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Cadeira simplificada para a visão geral (assento + encosto, ~20 triângulos). */
export function createSeatGeometry(): BufferGeometry {
  const pan = new BoxGeometry(0.44, 0.07, 0.42)
  pan.translate(0, 0.44, 0.02)
  const back = new BoxGeometry(0.44, 0.44, 0.05)
  back.translate(0, 0.22, 0)
  back.rotateX(-0.18)
  back.translate(0, 0.46, -0.2)
  const merged = mergeGeometries([pan, back])!
  merged.deleteAttribute('uv')
  return merged
}
