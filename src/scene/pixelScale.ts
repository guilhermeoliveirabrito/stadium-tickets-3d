import { useFrame } from '@react-three/fiber'
import type { Material, PerspectiveCamera, WebGLProgramParametersWithUniforms } from 'three'

/**
 * Tamanho de um pixel no mundo: a uma distância d da câmera, um pixel cobre
 * `d * uPixelAngle` metros. Com isso os shaders garantem que coisas pequenas
 * (lâmpadas, pessoas, cadeiras) nunca fiquem menores que um ou dois pixels,
 * o que as faria piscar quando a câmera se move.
 */
export const pixelUniforms = { uPixelAngle: { value: 0.001 } }

export function PixelScale() {
  useFrame((state) => {
    const camera = state.camera as PerspectiveCamera
    const fov = ((camera.fov ?? 35) * Math.PI) / 180
    pixelUniforms.uPixelAngle.value = (2 * Math.tan(fov / 2)) / Math.max(1, state.size.height * state.viewport.dpr)
  })
  return null
}

/** Encadeia mais uma modificação de shader num material que já tem onBeforeCompile. */
export function extendShader<T extends Material>(
  material: T,
  key: string,
  modify: (shader: WebGLProgramParametersWithUniforms) => void,
) {
  const previous = material.onBeforeCompile.bind(material)
  const previousKey = material.customProgramCacheKey.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer)
    modify(shader)
  }
  material.customProgramCacheKey = () => `${previousKey()}|${key}`
  return material
}
