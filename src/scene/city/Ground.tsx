import { useMemo } from 'react'
import { MeshLambertMaterial, MeshStandardMaterial, PlaneGeometry, Shape, ShapeGeometry } from 'three'
import { GROUND_TEXTURE_SIZE } from '../../config/quality'
import { getCity, WORLD } from '../../lib/city/layout'
import { once } from '../../lib/once'
import { canvasTexture } from '../../lib/textures'
import { withSurfaceNoise } from '../stadium/materials'
import { getCityLightMap } from './cityLight'
import { drawGround, FAR_GROUND } from './groundTexture'

const getGroundParts = once(() => {
  const city = getCity()
  const map = canvasTexture(GROUND_TEXTURE_SIZE, GROUND_TEXTURE_SIZE, (ctx, size) => drawGround(ctx, size, city), {
    anisotropy: 16,
  })
  const lightMap = getCityLightMap()
  const lake = new Shape()
  city.lake.forEach(([x, z], i) => (i ? lake.lineTo(x, -z) : lake.moveTo(x, -z)))
  return {
    ground: new PlaneGeometry(WORLD, WORLD),
    material: withSurfaceNoise(
      new MeshLambertMaterial({ map, lightMap, lightMapIntensity: 2.6 }),
      'ground',
      0.22,
    ),
    far: new PlaneGeometry(16000, 16000),
    farMaterial: new MeshLambertMaterial({ color: FAR_GROUND }),
    lake: new ShapeGeometry(lake, 1),
    water: new MeshStandardMaterial({ color: '#10222b', roughness: 0.05, metalness: 0.2, envMapIntensity: 2 }),
  }
})

export function Ground() {
  const parts = useMemo(() => getGroundParts(), [])

  return (
    <group>
      <mesh geometry={parts.ground} material={parts.material} rotation-x={-Math.PI / 2} receiveShadow />
      <mesh geometry={parts.far} material={parts.farMaterial} rotation-x={-Math.PI / 2} position-y={-0.3} />
      <mesh geometry={parts.lake} material={parts.water} rotation-x={-Math.PI / 2} position-y={0.12} receiveShadow />
    </group>
  )
}
