import { useLayoutEffect, useRef } from 'react'
import { BufferGeometry, InstancedMesh, Material, Matrix4 } from 'three'
import type { Frame } from '../../lib/bowl'
import { frameMatrix } from '../../lib/instancing'

interface Props {
  frames: Frame[]
  y: number | ((f: Frame, i: number) => number)
  geometry: BufferGeometry
  material: Material
  /** transformação local aplicada depois de alinhar ao contorno */
  local?: Matrix4 | ((f: Frame, i: number) => Matrix4)
  castShadow?: boolean
  receiveShadow?: boolean
}

/** Instancia uma geometria em cada ponto do contorno, alinhada à curva. */
export function FrameInstances({ frames, y, geometry, material, local, castShadow, receiveShadow }: Props) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new Matrix4()
    frames.forEach((f, i) => {
      const height = typeof y === 'function' ? y(f, i) : y
      const extra = typeof local === 'function' ? local(f, i) : local
      mesh.setMatrixAt(i, frameMatrix(f, height, m, extra))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [frames, y, local])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, frames.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}
