import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Lamp, LampKind } from '../../lib/city/layout'

interface Model {
  pole: BufferGeometry
  head: BufferGeometry
  warm: boolean
}

function models(): Record<LampKind, Model> {
  const street = {
    pole: mergeGeometries([
      new CylinderGeometry(0.08, 0.11, 8, 6).translate(0, 4, 0),
      new BoxGeometry(0.08, 0.08, 1.9).translate(0, 7.9, 0.9),
    ])!,
    head: new BoxGeometry(0.34, 0.12, 0.62).translate(0, 7.82, 1.85),
    warm: true,
  }
  const lot = {
    pole: mergeGeometries([
      new CylinderGeometry(0.12, 0.16, 11, 6).translate(0, 5.5, 0),
      new BoxGeometry(2.8, 0.12, 0.12).translate(0, 10.9, 0),
    ])!,
    head: mergeGeometries([
      new BoxGeometry(0.7, 0.14, 0.45).translate(-1.3, 10.8, 0),
      new BoxGeometry(0.7, 0.14, 0.45).translate(1.3, 10.8, 0),
    ])!,
    warm: false,
  }
  const plaza = {
    pole: new CylinderGeometry(0.06, 0.08, 4.4, 6).translate(0, 2.2, 0),
    head: new SphereGeometry(0.26, 10, 8).translate(0, 4.55, 0),
    warm: true,
  }
  const park = {
    pole: new CylinderGeometry(0.05, 0.07, 3.4, 6).translate(0, 1.7, 0),
    head: new SphereGeometry(0.22, 10, 8).translate(0, 3.5, 0),
    warm: true,
  }
  return { street, lot, plaza, park }
}

function Instances({ lamps, geometry, material }: { lamps: Lamp[]; geometry: BufferGeometry; material: Material }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const dummy = new Object3D()
    lamps.forEach((l, i) => {
      dummy.position.set(l.x, 0, l.z)
      dummy.rotation.set(0, l.yaw, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [lamps])
  return <instancedMesh ref={ref} args={[geometry, material, lamps.length]} />
}

export function StreetLights({ lamps }: { lamps: Lamp[] }) {
  const parts = useMemo(() => {
    const byKind = (kind: LampKind) => lamps.filter((l) => l.kind === kind)
    return {
      models: models(),
      groups: (['street', 'lot', 'plaza', 'park'] as LampKind[]).map((kind) => ({ kind, lamps: byKind(kind) })),
      metal: new MeshStandardMaterial({ color: '#3a3e45', roughness: 0.55, metalness: 0.6 }),
      warm: new MeshBasicMaterial({ color: new Color('#ffc58a').multiplyScalar(6) }),
      cool: new MeshBasicMaterial({ color: new Color('#eef3ff').multiplyScalar(7) }),
    }
  }, [lamps])

  return (
    <group>
      {parts.groups.map(({ kind, lamps: list }) =>
        list.length ? (
          <group key={kind}>
            <Instances lamps={list} geometry={parts.models[kind].pole} material={parts.metal} />
            <Instances
              lamps={list}
              geometry={parts.models[kind].head}
              material={parts.models[kind].warm ? parts.warm : parts.cool}
            />
          </group>
        ) : null,
      )}
    </group>
  )
}
