import { useMemo } from 'react'
import { MeshStandardMaterial, PlaneGeometry, Shape, ShapeGeometry } from 'three'
import { LAKE, PARK_SIZE } from '../../lib/park'
import { canvasTexture } from '../../lib/textures'
import { withSurfaceNoise } from '../stadium/materials'
import { drawGround, FAR_GROUND } from './groundTexture'

export function Ground() {
  const parts = useMemo(() => {
    const map = canvasTexture(4096, 4096, (ctx, size) => drawGround(ctx, size), { anisotropy: 16 })
    const lake = new Shape()
    LAKE.outline.forEach(([x, z], i) => (i ? lake.lineTo(x, -z) : lake.moveTo(x, -z)))
    return {
      ground: new PlaneGeometry(PARK_SIZE, PARK_SIZE),
      material: withSurfaceNoise(new MeshStandardMaterial({ map, roughness: 0.96 }), 'ground', 0.22),
      far: new PlaneGeometry(14000, 14000),
      farMaterial: new MeshStandardMaterial({ color: FAR_GROUND, roughness: 1 }),
      lake: new ShapeGeometry(lake, 1),
      water: new MeshStandardMaterial({ color: '#36606c', roughness: 0.07, metalness: 0.15, envMapIntensity: 1.5 }),
    }
  }, [])

  return (
    <group>
      <mesh geometry={parts.ground} material={parts.material} rotation-x={-Math.PI / 2} receiveShadow />
      <mesh geometry={parts.far} material={parts.farMaterial} rotation-x={-Math.PI / 2} position-y={-0.3} />
      <mesh geometry={parts.lake} material={parts.water} rotation-x={-Math.PI / 2} position-y={0.12} receiveShadow />
    </group>
  )
}
