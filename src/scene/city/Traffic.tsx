import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { getCity } from '../../lib/city/layout'
import { buildTraffic, sampleTrack } from '../../lib/city/traffic'
import { createGlowGeometry, createGlowMaterial } from '../glowMaterial'
import { createBeamGeometry, createCarBody, createTailGlowGeometry, getBeamTexture } from './carGeometry'
import { extendShader, pixelUniforms } from '../pixelScale'
import { withCityLight } from './cityLight'

/**
 * De longe os vidros (faixas de ~30 cm) ficam menores que um pixel e
 * cintilam como pontos escuros sobre os carros; o carro inteiro passa para um
 * tom médio da lataria, e o reflexo fica mais difuso para não faiscar.
 */
const CAR_FAR = /* glsl */ `
vCarFar = 0.0;
#if defined( USE_INSTANCING ) && defined( USE_INSTANCING_COLOR )
{
  vec4 carView = modelViewMatrix * instanceMatrix * vec4(0.0, 0.8, 0.0, 1.0);
  float carPixel = max(-carView.z, 0.0) * uPixelAngle;
  vCarFar = smoothstep(0.1, 0.3, carPixel);
  vec3 carBody = instanceColor.rgb;
  #ifdef CAR_PARKED
    // carros parados: de longe a cor se aproxima da média dos vizinhos da
    // fileira, sem o contraste de carro branco ao lado de carro preto que
    // "pulava" a cada movimento da câmera
    carBody = mix(carBody, aCarAverage, 0.6 * vCarFar);
  #endif
  vColor.rgb = mix(vColor.rgb, carBody * 0.8, vCarFar);
}
#endif
`

/** De longe o carro parado cresce até ocupar a vaga, e some a fresta escura entre os carros. */
const CAR_GROW = /* glsl */ `
#ifdef CAR_PARKED
  transformed.x *= mix(1.0, 1.37, vCarFar);
  transformed.z *= mix(1.0, 1.12, vCarFar);
#endif
`

function createCarPaint(parked: boolean) {
  const material = extendShader(
    withCityLight(
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.3 }),
      'cars',
      { strength: 1.8, falloff: 3 },
    ),
    'car-far',
    (shader) => {
      Object.assign(shader.uniforms, pixelUniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uPixelAngle;
          varying float vCarFar;
          #ifdef CAR_PARKED
            attribute vec3 aCarAverage;
          #endif`,
        )
        .replace('#include <color_vertex>', `#include <color_vertex>\n${CAR_FAR}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CAR_GROW}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCarFar;')
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.78, vCarFar);
          metalnessFactor = mix(metalnessFactor, 0.15, vCarFar);`,
        )
    },
  )
  if (parked) material.defines = { CAR_PARKED: '' }
  return material
}

/** Média das cores de até 3 carros de cada lado, na mesma fileira de vagas. */
function rowAverage(cars: { x: number; z: number; color: string }[]) {
  const out = new Float32Array(cars.length * 3)
  const color = new Color()
  const rows = new Map<number, number[]>()
  cars.forEach((c, i) => {
    const key = Math.round(c.x * 10)
    if (!rows.has(key)) rows.set(key, [])
    rows.get(key)!.push(i)
  })
  for (const list of rows.values()) {
    list.sort((a, b) => cars[a].z - cars[b].z)
    list.forEach((index, k) => {
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let j = Math.max(0, k - 3); j <= Math.min(list.length - 1, k + 3); j++) {
        color.set(cars[list[j]].color)
        r += color.r
        g += color.g
        b += color.b
        n++
      }
      out.set([r / n, g / n, b / n], index * 3)
    })
  }
  return out
}

const HEAD = new Color('#fff0d8')
const TAIL = new Color('#ff1a0d')
/** lanterna com o freio acionado */
const BRAKE_BOOST = 2.3

export function Traffic() {
  const plan = useMemo(() => buildTraffic(getCity()), [])
  const carCount = plan.cars.length
  const parts = useMemo(
    () => ({
      body: createCarBody(),
      beam: createBeamGeometry(),
      glow: createTailGlowGeometry(),
      paint: createCarPaint(false),
      parkedPaint: createCarPaint(true),
      parkedBody: createCarBody(),
      // faróis e lanternas como brilhos: nunca menores que 2 pixels, então não
      // piscam de longe (antes eram caixinhas finas e muito brilhantes)
      heads: createGlowGeometry(new Float32Array(carCount * 3), new Float32Array(carCount * 3)),
      tails: createGlowGeometry(new Float32Array(carCount * 3), new Float32Array(carCount * 3)),
      headMaterial: createGlowMaterial(1.9, 5, 2.2),
      tailMaterial: createGlowMaterial(1.3, 3.2, 2),
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
    [carCount],
  )

  const bodies = useRef<InstancedMesh>(null)
  const beams = useRef<InstancedMesh>(null)
  const glows = useRef<InstancedMesh>(null)
  const parked = useRef<InstancedMesh>(null)
  const clock = useRef(0)

  useLayoutEffect(() => {
    const color = new Color()
    plan.cars.forEach((car, i) => {
      bodies.current!.setColorAt(i, color.set(car.color))
    })
    for (const mesh of [bodies.current, beams.current, glows.current]) {
      mesh!.instanceMatrix.setUsage(DynamicDrawUsage)
    }
    for (const g of [parts.heads, parts.tails]) {
      for (const name of ['position', 'aColor']) (g.getAttribute(name) as BufferAttribute).setUsage(DynamicDrawUsage)
    }
    const dummy = new Object3D()
    plan.parked.forEach((car, i) => {
      dummy.position.set(car.x, 0, car.z)
      dummy.rotation.set(0, car.yaw, 0)
      dummy.updateMatrix()
      parked.current!.setMatrixAt(i, dummy.matrix)
      parked.current!.setColorAt(i, color.set(car.color))
    })
    parts.parkedBody.setAttribute('aCarAverage', new InstancedBufferAttribute(rowAverage(plan.parked), 3))
    parked.current!.instanceMatrix.needsUpdate = true
    parked.current!.instanceColor!.needsUpdate = true
    parked.current!.computeBoundingSphere()
  }, [plan, parts])

  const scratch = useRef({
    dummy: new Object3D(),
    hidden: new Matrix4().makeScale(0, 0, 0),
    sample: { x: 0, z: 0, heading: 0, speed: 0, braking: false, lights: true },
  })

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.1)
    const { dummy, hidden, sample } = scratch.current
    const pools = [beams.current!, glows.current!]
    const headPos = parts.heads.getAttribute('position') as BufferAttribute
    const headColor = parts.heads.getAttribute('aColor') as BufferAttribute
    const tailPos = parts.tails.getAttribute('position') as BufferAttribute
    const tailColor = parts.tails.getAttribute('aColor') as BufferAttribute
    plan.cars.forEach((car, i) => {
      sampleTrack(plan.tracks[car.track], clock.current + car.offset, sample)
      dummy.position.set(sample.x, 0, sample.z)
      dummy.rotation.set(0, sample.heading, 0)
      dummy.updateMatrix()
      bodies.current!.setMatrixAt(i, dummy.matrix)
      // estacionado com o motor desligado: faróis, lanternas e manchas apagam
      for (const mesh of pools) mesh.setMatrixAt(i, sample.lights ? dummy.matrix : hidden)
      const sx = Math.sin(sample.heading)
      const sz = Math.cos(sample.heading)
      headPos.setXYZ(i, sample.x + sx * 2.3, 0.72, sample.z + sz * 2.3)
      tailPos.setXYZ(i, sample.x - sx * 2.3, 0.78, sample.z - sz * 2.3)
      const on = sample.lights ? 1 : 0
      const brake = sample.braking ? BRAKE_BOOST : 1
      headColor.setXYZ(i, HEAD.r * on, HEAD.g * on, HEAD.b * on)
      tailColor.setXYZ(i, TAIL.r * on * brake, TAIL.g * on * brake, TAIL.b * on * brake)
    })
    bodies.current!.instanceMatrix.needsUpdate = true
    for (const mesh of pools) mesh.instanceMatrix.needsUpdate = true
    for (const attr of [headPos, headColor, tailPos, tailColor]) attr.needsUpdate = true
  })

  const count = plan.cars.length
  return (
    <group>
      <instancedMesh ref={bodies} args={[parts.body, parts.paint, count]} frustumCulled={false} />
      <points geometry={parts.heads} material={parts.headMaterial} frustumCulled={false} renderOrder={2} />
      <points geometry={parts.tails} material={parts.tailMaterial} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={beams} args={[parts.beam, parts.beamMaterial, count]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={glows} args={[parts.glow, parts.glowMaterial, count]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={parked} args={[parts.parkedBody, parts.parkedPaint, plan.parked.length]} />
    </group>
  )
}
