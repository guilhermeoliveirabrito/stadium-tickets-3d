import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  type BufferAttribute,
  type Group,
  type Mesh,
  MeshLambertMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { nonIndexed } from '../../lib/nonIndexed'
import { once } from '../../lib/once'
import { createGlowGeometry, createGlowMaterial } from '../glowMaterial'
import { outside } from '../outside'
import { outsideFog } from '../outsideFog'

/**
 * Voo em volta do estádio, por cima da cobertura: elipse por dentro da volta
 * do dirigível e 40 m abaixo dele, para os dois nunca se cruzarem (nem vistos
 * de cima, onde antes pareciam bater). Semieixos, altura e duração da volta (s).
 */
const ORBIT = { rx: 130, rz: 82, height: 88, period: 80, start: 2.3 }
/** raio do círculo de luz no gramado (m) */
const SPOT = 7

function createBody() {
  const parts = [
    new CapsuleGeometry(0.95, 2.4, 4, 10).rotateZ(Math.PI / 2),
    new CylinderGeometry(0.16, 0.32, 5.2, 6).rotateZ(Math.PI / 2).translate(-3.8, 0.35, 0),
    new BoxGeometry(1.1, 1.3, 0.12).translate(-6.2, 0.9, 0),
    new BoxGeometry(3.4, 0.08, 0.08).translate(0.1, -1.25, 0.75),
    new BoxGeometry(3.4, 0.08, 0.08).translate(0.1, -1.25, -0.75),
    new BoxGeometry(0.1, 0.55, 1.6).translate(0.9, -1.0, 0),
    new BoxGeometry(0.1, 0.55, 1.6).translate(-0.7, -1.0, 0),
    new CylinderGeometry(0.12, 0.12, 0.5, 6).translate(0.2, 1.1, 0),
  ]
  return mergeGeometries(parts.map(nonIndexed))!
}

/** Feixe do holofote: cone aberto, mais forte perto da lâmpada e nas linhas de visada centrais. */
function createBeamMaterial() {
  return new ShaderMaterial({
    uniforms: { uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vNormalView;
      varying vec3 vView;
      void main() {
        vAlong = -position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying float vAlong;
      varying vec3 vNormalView;
      varying vec3 vView;
      void main() {
        float facing = abs(dot(normalize(vNormalView), normalize(vView)));
        float intensity = pow(facing, 1.6) * (1.0 - 0.65 * vAlong) * 0.24 * uFade;
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.88) * intensity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
}

/** Círculo de luz no gramado, suave nas bordas. */
function createSpotMaterial() {
  return new ShaderMaterial({
    uniforms: { uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float light = (1.0 - smoothstep(0.55, 1.0, d)) * 0.38 * uFade;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * light, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  })
}

const getHelicopterParts = once(() => ({
  body: createBody(),
  rotor: new BoxGeometry(10, 0.05, 0.28),
  tailRotor: new BoxGeometry(1.6, 0.18, 0.04).translate(0, 0, 0.18),
  paint: new MeshLambertMaterial({ color: '#2a2f38', emissive: '#10141b' }),
  // cone com a ponta na origem, de altura 1 descendo em -y e raio 1 na base
  beam: new ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0),
  beamMaterial: createBeamMaterial(),
  spot: new CircleGeometry(1, 32).rotateX(-Math.PI / 2),
  spotMaterial: createSpotMaterial(),
  // luzes: farol de busca (branco), anticolisão vermelha piscando e navegação
  lights: createGlowGeometry(new Float32Array(4 * 3), new Float32Array(4 * 3)),
  lightMaterial: createGlowMaterial(1.1, 7, 2.2),
}))

const DOWN = new Vector3(0, -1, 0)

/** Helicóptero dando voltas por fora da cobertura, com o holofote varrendo o gramado. */
export function Helicopter() {
  const parts = useMemo(() => getHelicopterParts(), [])
  const group = useRef<Group>(null)
  const craft = useRef<Group>(null)
  const rotor = useRef<Mesh>(null)
  const tail = useRef<Mesh>(null)
  const beam = useRef<Mesh>(null)
  const spot = useRef<Mesh>(null)
  const scratch = useMemo(
    () => ({ lamp: new Vector3(), target: new Vector3(), dir: new Vector3(), q: new Quaternion(), v: new Vector3() }),
    [],
  )

  useFrame((state) => {
    const root = group.current
    if (!root || !craft.current || !rotor.current || !tail.current || !beam.current || !spot.current) return
    root.visible = outside.visible
    if (!root.visible) return
    const t = state.clock.elapsedTime
    const a = ORBIT.start + (t / ORBIT.period) * Math.PI * 2
    const x = Math.cos(a) * ORBIT.rx
    const z = Math.sin(a) * ORBIT.rz
    const y = ORBIT.height + Math.sin(t * 0.7) * 1.2
    // de frente para o estádio, voando de lado (como quem filma o jogo)
    craft.current.position.set(x, y, z)
    craft.current.rotation.set(0.06 * Math.sin(t * 0.9), Math.atan2(z, -x), -0.05)
    rotor.current.rotation.y = t * 21
    tail.current.rotation.z = t * 37

    // holofote: da frente do helicóptero até um ponto que passeia pelo gramado
    const { lamp, target, dir, q } = scratch
    lamp.set(1.4, -0.9, 0).applyEuler(craft.current.rotation).add(craft.current.position)
    target.set(Math.sin(t * 0.21) * 34, 0.06, Math.sin(t * 0.29 + 1) * 20)
    dir.subVectors(target, lamp)
    const length = dir.length()
    q.setFromUnitVectors(DOWN, dir.normalize())
    beam.current.position.copy(lamp)
    beam.current.quaternion.copy(q)
    beam.current.scale.set(SPOT, length, SPOT)
    spot.current.position.copy(target)
    spot.current.scale.setScalar(SPOT)
    // entrando no estádio o holofote some junto com o entorno
    const fade = 1 - outsideFog.value
    const shared = getHelicopterParts()
    shared.beamMaterial.uniforms.uFade.value = fade
    shared.spotMaterial.uniforms.uFade.value = fade

    // luzes: busca (fixa), anticolisão vermelha (piscando), verde e vermelha nas laterais
    const pos = shared.lights.getAttribute('position') as BufferAttribute
    const col = shared.lights.getAttribute('aColor') as BufferAttribute
    const blink = t % 1.2 < 0.12 ? 1 : 0
    const points: [number, number, number, number, number, number][] = [
      [1.5, -0.9, 0, 1, 0.97, 0.9],
      [0.2, 1.35, 0, blink, 0.05 * blink, 0.03 * blink],
      [0, -0.2, 1.05, 0.1, 1, 0.2],
      [0, -0.2, -1.05, 1, 0.08, 0.05],
    ]
    const { v } = scratch
    points.forEach(([lx, ly, lz, r, g, b], i) => {
      v.set(lx, ly, lz).applyEuler(craft.current!.rotation).add(craft.current!.position)
      pos.setXYZ(i, v.x, v.y, v.z)
      col.setXYZ(i, r, g, b)
    })
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  return (
    <group ref={group}>
      <group ref={craft}>
        <mesh geometry={parts.body} material={parts.paint} />
        <mesh ref={rotor} geometry={parts.rotor} material={parts.paint} position={[0.2, 1.42, 0]} />
        <mesh ref={tail} geometry={parts.tailRotor} material={parts.paint} position={[-6.2, 0.9, 0.1]} />
      </group>
      <mesh ref={beam} geometry={parts.beam} material={parts.beamMaterial} frustumCulled={false} />
      <mesh ref={spot} geometry={parts.spot} material={parts.spotMaterial} frustumCulled={false} />
      <points geometry={parts.lights} material={parts.lightMaterial} frustumCulled={false} />
    </group>
  )
}
