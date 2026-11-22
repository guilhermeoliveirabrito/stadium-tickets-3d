import { useMemo } from 'react'
import { MeshStandardMaterial, PlaneGeometry, Shape, ShapeGeometry } from 'three'
import { type CityLayout, WORLD } from '../../lib/city/layout'
import { canvasTexture } from '../../lib/textures'
import { withSurfaceNoise } from '../stadium/materials'
import { drawGround, drawLightMap, FAR_GROUND } from './groundTexture'

export function Ground({ city }: { city: CityLayout }) {
  const parts = useMemo(() => {
    const map = canvasTexture(4096, 4096, (ctx, size) => drawGround(ctx, size, city), { anisotropy: 16 })
    const lightMap = canvasTexture(2048, 2048, (ctx, size) => drawLightMap(ctx, size, city), { anisotropy: 4 })
    lightMap.channel = 0
    const lake = new Shape()
    city.lake.forEach(([x, z], i) => (i ? lake.lineTo(x, -z) : lake.moveTo(x, -z)))
    return {
      ground: new PlaneGeometry(WORLD, WORLD),
      material: withSurfaceNoise(
        new MeshStandardMaterial({ map, lightMap, lightMapIntensity: 2.6, roughness: 0.95 }),
        'ground',
        0.22,
      ),
      far: new PlaneGeometry(16000, 16000),
      farMaterial: new MeshStandardMaterial({ color: FAR_GROUND, roughness: 1 }),
      lake: new ShapeGeometry(lake, 1),
      water: new MeshStandardMaterial({ color: '#10222b', roughness: 0.05, metalness: 0.2, envMapIntensity: 2 }),
    }
  }, [city])

  return (
    <group>
      <mesh geometry={parts.ground} material={parts.material} rotation-x={-Math.PI / 2} receiveShadow />
      <mesh geometry={parts.far} material={parts.farMaterial} rotation-x={-Math.PI / 2} position-y={-0.3} />
      <mesh geometry={parts.lake} material={parts.water} rotation-x={-Math.PI / 2} position-y={0.12} receiveShadow />
    </group>
  )
}
