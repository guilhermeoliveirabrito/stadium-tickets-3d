import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { getCity } from '../../lib/city/layout'
import { buildTraffic, sampleTrack } from '../../lib/city/traffic'
import {
  createBeamGeometry,
  createCarBody,
  createHeadlights,
  createTailGlowGeometry,
  createTaillights,
  getBeamTexture,
} from './carGeometry'
import { withCityLight } from './cityLight'

const BRAKE = new Color(2.4, 2.4, 2.4)
const CRUISE = new Color(1, 1, 1)

export function Traffic() {
  const plan = useMemo(() => buildTraffic(getCity()), [])
  const parts = useMemo(
    () => ({
      body: createCarBody(),
      heads: createHeadlights(),
      tails: createTaillights(),
      beam: createBeamGeometry(),
      glow: createTailGlowGeometry(),
      paint: withCityLight(
        new MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.3 }),
        'cars',
        { strength: 2.4, falloff: 3 },
      ),
      headMaterial: new MeshBasicMaterial({ vertexColors: true, color: new Color(6, 6, 6) }),
      tailMaterial: new MeshBasicMaterial({ vertexColors: true, color: new Color(3.2, 3.2, 3.2) }),
      beamMaterial: new MeshBasicMaterial({
        map: getBeamTexture(),
        color: new Color(1, 0.84, 0.6).multiplyScalar(0.32),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      glowMaterial: new MeshBasicMaterial({
        map: getBeamTexture(),
        color: new Color(1, 0.08, 0.04).multiplyScalar(0.28),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  )

  const bodies = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const tails = useRef<InstancedMesh>(null)
  const beams = useRef<InstancedMesh>(null)
  const glows = useRef<InstancedMesh>(null)
  const parked = useRef<InstancedMesh>(null)
  const clock = useRef(0)

  useLayoutEffect(() => {
    const color = new Color()
    plan.cars.forEach((car, i) => {
      bodies.current!.setColorAt(i, color.set(car.color))
      tails.current!.setColorAt(i, CRUISE)
    })
    for (const mesh of [bodies.current, heads.current, tails.current, beams.current, glows.current]) {
      mesh!.instanceMatrix.setUsage(DynamicDrawUsage)
    }
    const dummy = new Object3D()
    plan.parked.forEach((car, i) => {
      dummy.position.set(car.x, 0, car.z)
      dummy.rotation.set(0, car.yaw, 0)
      dummy.updateMatrix()
      parked.current!.setMatrixAt(i, dummy.matrix)
      parked.current!.setColorAt(i, color.set(car.color))
    })
    parked.current!.instanceMatrix.needsUpdate = true
    parked.current!.instanceColor!.needsUpdate = true
    parked.current!.computeBoundingSphere()
  }, [plan])

  const scratch = useRef({
    dummy: new Object3D(),
    hidden: new Matrix4().makeScale(0, 0, 0),
    sample: { x: 0, z: 0, heading: 0, speed: 0, braking: false, lights: true },
  })

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.1)
    const { dummy, hidden, sample } = scratch.current
    const lights = [heads.current!, tails.current!, beams.current!, glows.current!]
    const meshes = [bodies.current!, ...lights]
    plan.cars.forEach((car, i) => {
      sampleTrack(plan.tracks[car.track], clock.current + car.offset, sample)
      dummy.position.set(sample.x, 0, sample.z)
      dummy.rotation.set(0, sample.heading, 0)
      dummy.updateMatrix()
      bodies.current!.setMatrixAt(i, dummy.matrix)
      // estacionado com o motor desligado: faróis, lanternas e manchas apagam
      for (const mesh of lights) mesh.setMatrixAt(i, sample.lights ? dummy.matrix : hidden)
      tails.current!.setColorAt(i, sample.braking ? BRAKE : CRUISE)
    })
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true
    tails.current!.instanceColor!.needsUpdate = true
  })

  const count = plan.cars.length
  return (
    <group>
      <instancedMesh ref={bodies} args={[parts.body, parts.paint, count]} frustumCulled={false} />
      <instancedMesh ref={heads} args={[parts.heads, parts.headMaterial, count]} frustumCulled={false} />
      <instancedMesh ref={tails} args={[parts.tails, parts.tailMaterial, count]} frustumCulled={false} />
      <instancedMesh ref={beams} args={[parts.beam, parts.beamMaterial, count]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={glows} args={[parts.glow, parts.glowMaterial, count]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={parked} args={[parts.body, parts.paint, plan.parked.length]} />
    </group>
  )
}
