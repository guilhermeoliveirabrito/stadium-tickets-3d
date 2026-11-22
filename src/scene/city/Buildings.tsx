import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three'
import type { Building } from '../../lib/city/layout'
import { mulberry32 } from '../../lib/random'
import { createBuildingMaterial } from './buildingMaterial'
import { withCityLight } from './cityLight'

const KIND_INDEX = { house: 0, apartment: 1, tower: 2 } as const
const ROOF_COLORS = ['#8a4a35', '#7a4030', '#3d4045', '#5b4636', '#6e3b2c']

/** Telhado de duas águas com a cumeeira no eixo X (1 x 1 x 1, base em y = 0). */
function createGableGeometry() {
  const v = [
    // águas
    [-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 1, 0], [-0.5, 1, 0],
    [0.5, 0, 0.5], [-0.5, 0, 0.5], [-0.5, 1, 0], [0.5, 1, 0],
  ]
  const positions: number[] = []
  const quad = (a: number[], b: number[], c: number[], d: number[]) => positions.push(...a, ...b, ...c, ...a, ...c, ...d)
  quad(v[0], v[3], v[2], v[1])
  quad(v[4], v[7], v[6], v[5])
  // oitões
  positions.push(-0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0)
  positions.push(0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

export function Buildings({ buildings }: { buildings: Building[] }) {
  const bodies = useRef<InstancedMesh>(null)
  const roofs = useRef<InstancedMesh>(null)
  const beacons = useRef<InstancedMesh>(null)

  const parts = useMemo(() => {
    const rand = mulberry32(77)
    const body = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const info = new Float32Array(buildings.length * 4)
    buildings.forEach((b, i) => {
      // escritórios do skyline ficam mais apagados à noite
      const lit = b.kind === 'house' ? 0.22 + rand() * 0.38 : b.kind === 'apartment' ? 0.35 + rand() * 0.35 : 0.12 + rand() * 0.36
      info.set([b.seed, KIND_INDEX[b.kind], b.shops ? 1 : 0, lit], i * 4)
    })
    body.setAttribute('aBuilding', new InstancedBufferAttribute(info, 4))
    const gables = buildings.filter((b) => b.gable)
    const tall = buildings.filter((b) => b.kind === 'tower' && b.h > 80)
    return {
      body,
      material: createBuildingMaterial(),
      gables,
      roof: createGableGeometry(),
      roofMaterial: withCityLight(new MeshStandardMaterial({ roughness: 0.85 }), 'roofs', { strength: 1.5, falloff: 9 }),
      tall,
      beacon: new SphereGeometry(0.9, 8, 6),
      beaconMaterial: new MeshBasicMaterial({ color: new Color('#ff2a1a').multiplyScalar(6) }),
    }
  }, [buildings])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    const color = new Color()
    const rand = mulberry32(5)
    buildings.forEach((b, i) => {
      dummy.position.set(b.x, 0, b.z)
      dummy.rotation.set(0, b.yaw, 0)
      dummy.scale.set(b.w, b.h, b.d)
      dummy.updateMatrix()
      bodies.current!.setMatrixAt(i, dummy.matrix)
      bodies.current!.setColorAt(i, color.set(b.color))
    })
    parts.gables.forEach((b, i) => {
      dummy.position.set(b.x, b.h, b.z)
      dummy.rotation.set(0, b.yaw, 0)
      dummy.scale.set(b.w + 0.6, Math.min(3.2, b.d * 0.3), b.d + 0.7)
      dummy.updateMatrix()
      roofs.current!.setMatrixAt(i, dummy.matrix)
      roofs.current!.setColorAt(i, color.set(ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)]))
    })
    parts.tall.forEach((b, i) => {
      dummy.position.set(b.x, b.h + 1.2, b.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      beacons.current?.setMatrixAt(i, dummy.matrix)
    })
    for (const mesh of [bodies.current, roofs.current, beacons.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [buildings, parts])

  // luzes de sinalização piscando no alto das torres
  const blink = useRef(0)
  useFrame((_, delta) => {
    blink.current = (blink.current + delta) % 1.8
    if (beacons.current) beacons.current.visible = blink.current < 0.7
  })

  return (
    <group>
      <instancedMesh ref={bodies} args={[parts.body, parts.material, buildings.length]} receiveShadow />
      <instancedMesh ref={roofs} args={[parts.roof, parts.roofMaterial, parts.gables.length]} receiveShadow />
      {parts.tall.length > 0 && (
        <instancedMesh ref={beacons} args={[parts.beacon, parts.beaconMaterial, parts.tall.length]} />
      )}
    </group>
  )
}
