import { useMemo } from 'react'
import { Float32BufferAttribute, MeshLambertMaterial, MeshStandardMaterial, Path, Shape, ShapeGeometry } from 'three'
import { GROUND_TEXTURE_SIZE } from '../../config/quality'
import { roundedLoop } from '../../lib/city/geometry'
import { getCity, HALF, WORLD } from '../../lib/city/layout'
import { once } from '../../lib/once'
import { canvasTexture } from '../../lib/textures'
import { withSurfaceNoise } from '../stadium/materials'
import { getCityLightMap } from './cityLight'
import { drawGround, FAR_GROUND } from './groundTexture'

/** Quadrado de lado `size` (coordenadas da forma: x, -z), opcionalmente com um furo. */
function square(size: number, hole?: Path) {
  const h = size / 2
  const shape = new Shape([
    { x: -h, y: -h },
    { x: h, y: -h },
    { x: h, y: h },
    { x: -h, y: h },
  ] as never)
  if (hole) shape.holes.push(hole)
  return shape
}

/**
 * Chão da cidade com um furo sob o gramado. Antes ele passava por baixo do
 * estádio, 5 cm abaixo do gramado; com a câmera longe (no celular em pé a
 * vista aérea fica a ~1,2 km), a placa de vídeo não distingue 5 cm de
 * profundidade e o chão aparecia em manchas piscando sobre o gramado. O
 * furo fica 0,5 m além da borda do campo, escondido sob as arquibancadas.
 */
function groundGeometry() {
  const hole = new Path(roundedLoop(0.5, 2).map(([x, z]) => ({ x, y: -z }) as never))
  const geometry = new ShapeGeometry(square(WORLD, hole), 1)
  // UV do chão inteiro (0 a 1), como no plano de antes
  const pos = geometry.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + HALF) / WORLD
    uv[i * 2 + 1] = (pos.getY(i) + HALF) / WORLD
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return geometry
}

/** Chão distante, com um furo onde está o chão da cidade (sem sobreposição). */
function farGeometry() {
  const h = HALF - 2
  const hole = new Path([
    { x: -h, y: -h },
    { x: -h, y: h },
    { x: h, y: h },
    { x: h, y: -h },
  ] as never)
  return new ShapeGeometry(square(16000, hole), 1)
}

const getGroundParts = once(() => {
  const city = getCity()
  const map = canvasTexture(GROUND_TEXTURE_SIZE, GROUND_TEXTURE_SIZE, (ctx, size) => drawGround(ctx, size, city), {
    anisotropy: 16,
  })
  const lightMap = getCityLightMap()
  const lake = new Shape()
  city.lake.forEach(([x, z], i) => (i ? lake.lineTo(x, -z) : lake.moveTo(x, -z)))
  return {
    ground: groundGeometry(),
    // empurra o chão um pouco para trás na profundidade: o lago e as manchas
    // de luz dos faróis, logo acima dele, não piscam vistos de longe
    material: withSurfaceNoise(
      new MeshLambertMaterial({
        map,
        lightMap,
        lightMapIntensity: 2.6,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 2,
      }),
      'ground',
      0.22,
    ),
    far: farGeometry(),
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
