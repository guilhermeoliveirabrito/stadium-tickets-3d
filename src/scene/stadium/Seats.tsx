import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { getLayout } from '../../lib/layout'
import { mulberry32 } from '../../lib/random'
import { createSeatGeometry } from './seatGeometry'

export const SEAT_COLORS = {
  taken: new Color('#cf1f2e'),
  available: new Color('#1f4fd6'),
}

export function Seats() {
  const { seats } = getLayout()
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(createSeatGeometry, [])
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.38, metalness: 0 }), [])

  useLayoutEffect(() => {
    const mesh = ref.current!
    const dummy = new Object3D()
    const color = new Color()
    const rand = mulberry32(42)
    for (let i = 0; i < seats.count; i++) {
      dummy.position.fromArray(seats.position, i * 3)
      dummy.rotation.set(0, seats.yaw[i], 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // leve variação de tom, como plástico desbotado pelo sol
      color.copy(seats.taken[i] ? SEAT_COLORS.taken : SEAT_COLORS.available)
      color.multiplyScalar(0.92 + rand() * 0.14)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [seats])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, seats.count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}
