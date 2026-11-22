import { useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { getLayout } from '../../lib/layout'
import { buildStandsGeometry } from '../../lib/standsGeometry'
import { withSurfaceNoise } from './materials'

export function Stands() {
  const geometry = useMemo(() => buildStandsGeometry(getLayout()), [])
  const material = useMemo(
    () =>
      withSurfaceNoise(new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }), 'stands', {
        vertexEmissive: true,
        fill: 1.15,
      }),
    [],
  )
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}
