import { useMemo } from 'react'
import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BOWL, PITCH } from '../../config/stadium'
import { once } from '../../lib/once'
import { getNoiseTexture } from '../../lib/textures'
import { FLASH_HEADER, flashTerm, flashUniforms } from '../lighting'
import { withLocalFill } from './materials'
import { pitchShaderChunk } from './pitchShader'

function roundedRect(halfX: number, halfZ: number, r: number) {
  const s = new Shape()
  s.moveTo(-halfX + r, -halfZ)
  s.lineTo(halfX - r, -halfZ)
  s.absarc(halfX - r, -halfZ + r, r, -Math.PI / 2, 0, false)
  s.lineTo(halfX, halfZ - r)
  s.absarc(halfX - r, halfZ - r, r, 0, Math.PI / 2, false)
  s.lineTo(-halfX + r, halfZ)
  s.absarc(-halfX + r, halfZ - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-halfX, -halfZ + r)
  s.absarc(-halfX + r, -halfZ + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

function createPitchMaterial() {
  const material = new MeshLambertMaterial()
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNoise = { value: getNoiseTexture() }
    Object.assign(shader.uniforms, flashUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPitch;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPitch = vec2(position.x, -position.y);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${pitchShaderChunk}\n${FLASH_HEADER}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = pitchColor(vPitch);')
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        // gramado sob os refletores: mais claro no centro, onde os feixes se somam
        irradiance += vec3(0.96, 0.98, 1.0) * mix(4.4, 3.2, smoothstep(18.0, 70.0, length(vPitch)));
        ${flashTerm('vec3(vPitch.x, 0.0, vPitch.y)')}`,
      )
  }
  material.customProgramCacheKey = () => 'pitch'
  return material
}

/** formato da rede: fundo do teto (a partir da linha do gol) e fundo no chão, em metros */
const NET_SHAPE = { topDepth: 0.9, depth: 2.1 }

function createNetGeometry() {
  const w = PITCH.goalHalfWidth
  const h = PITCH.goalHeight
  const { topDepth, depth } = NET_SHAPE
  const cell = 0.14
  // (x para fora da linha de gol, y, z)
  const quads: number[][][] = [
    [[0, h, -w], [topDepth, h, -w], [topDepth, h, w], [0, h, w]],
    [[topDepth, h, -w], [depth, 0, -w], [depth, 0, w], [topDepth, h, w]],
    [[0, 0, -w], [depth, 0, -w], [topDepth, h, -w], [0, h, -w]],
    [[0, 0, w], [0, h, w], [topDepth, h, w], [depth, 0, w]],
  ]
  const positions: number[] = []
  const uvs: number[] = []
  const project = (q: number[][], i: number) => {
    // projeta no plano dominante para gerar UV em metros
    const [ax, ay, az] = q[0]
    const [bx, by, bz] = q[1]
    const [cx, cy, cz] = q[2]
    const ux = bx - ax, uy = by - ay, uz = bz - az
    const vx = cx - bx, vy = cy - by, vz = cz - bz
    const nx = Math.abs(uy * vz - uz * vy)
    const ny = Math.abs(uz * vx - ux * vz)
    const nz = Math.abs(ux * vy - uy * vx)
    const [x, y, z] = q[i]
    if (nz >= nx && nz >= ny) return [x / cell, y / cell]
    if (ny >= nx) return [x / cell, z / cell]
    return [z / cell, (y + x * 0.4) / cell]
  }
  for (const q of quads) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(...q[i])
      uvs.push(...project(q, i))
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.computeVertexNormals()
  return g
}

/**
 * Rede desenhada no shader, sem textura: losangos com antisserrilhado e,
 * quando o fio fica mais fino que um pixel, a cobertura média dele (um véu
 * branco, como uma rede de verdade vista de longe). A textura com corte por
 * transparência sumia de longe, principalmente sem MSAA.
 */
function createNetMaterial() {
  const material = new MeshBasicMaterial({
    color: '#e8ecef',
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vNetUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNetUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vNetUv;')
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        {
          // losangos: as duas diagonais da grade em células
          vec2 g = vec2(vNetUv.x + vNetUv.y, vNetUv.x - vNetUv.y);
          vec2 fw = max(fwidth(g), vec2(1e-4));
          vec2 dist = 0.5 - abs(fract(g) - 0.5);
          const float thread = ${NET_THREAD.toFixed(3)};
          vec2 lines = 1.0 - smoothstep(vec2(thread) - fw, vec2(thread) + fw, dist);
          float strands = max(lines.x, lines.y);
          float coverage = 1.0 - (1.0 - 2.0 * thread) * (1.0 - 2.0 * thread);
          float far = smoothstep(0.6, 1.6, max(fw.x, fw.y) / (2.0 * thread));
          diffuseColor.a *= mix(strands, coverage, far) * 0.92;
        }`,
      )
  }
  material.customProgramCacheKey = () => 'goal-net'
  return material
}

/** meia espessura do fio, em frações da célula da rede */
const NET_THREAD = 0.05

/** Barra (cilindro) de a até b. */
function bar(a: Vector3, b: Vector3, radius: number, segments: number) {
  const g = new CylinderGeometry(radius, radius, a.distanceTo(b), segments, 1, false)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()))
  const mid = a.clone().add(b).multiplyScalar(0.5)
  return g.translate(mid.x, mid.y, mid.z)
}

/** Traves, travessão e a armação de trás que segura a rede, numa geometria só. */
function createGoalFrame() {
  const post = PITCH.goalHalfWidth + 0.06
  const h = PITCH.goalHeight
  const w = PITCH.goalHalfWidth
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
  const parts = [
    bar(v(0, 0, -post), v(0, h + 0.06, -post), 0.06, 12),
    bar(v(0, 0, post), v(0, h + 0.06, post), 0.06, 12),
    bar(v(0, h + 0.03, -post - 0.06), v(0, h + 0.03, post + 0.06), 0.06, 12),
  ]
  // armação: em cima, descendo atrás e no chão (bem mais fina que as traves)
  const topDepth = NET_SHAPE.topDepth
  const depth = NET_SHAPE.depth
  for (const z of [-w, w]) {
    parts.push(bar(v(0, h, z), v(topDepth, h, z), 0.022, 6))
    parts.push(bar(v(topDepth, h, z), v(depth, 0.02, z), 0.022, 6))
    parts.push(bar(v(0, 0.02, z), v(depth, 0.02, z), 0.022, 6))
  }
  parts.push(bar(v(topDepth, h, -w), v(topDepth, h, w), 0.022, 6))
  parts.push(bar(v(depth, 0.02, -w), v(depth, 0.02, w), 0.022, 6))
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!
  parts.forEach((p) => p.dispose())
  return g
}

const getGoalParts = once(() => ({
  net: createNetGeometry(),
  netMaterial: createNetMaterial(),
  frame: createGoalFrame(),
  // as traves recebem a luz dos refletores (com a luz comum, de perto ficavam escuras)
  frameMaterial: withLocalFill(new MeshLambertMaterial({ color: '#f4f4f2' }), 'goal-frame', 1.4),
}))

function Goal({ side }: { side: 1 | -1 }) {
  const { net, netMaterial, frame, frameMaterial } = useMemo(() => getGoalParts(), [])
  const x = side * (PITCH.halfLength + 0.06)
  return (
    <group position-x={x} scale-x={side}>
      <mesh geometry={frame} material={frameMaterial} />
      <mesh geometry={net} material={netMaterial} renderOrder={1} />
    </group>
  )
}

function CornerFlag({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.75} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 1.5, 6]} />
        <meshStandardMaterial color="#f2f2f2" />
      </mesh>
      <mesh position={[0.2, 1.32, 0]}>
        <planeGeometry args={[0.4, 0.3]} />
        <meshStandardMaterial color="#ff5a1f" side={DoubleSide} />
      </mesh>
    </group>
  )
}

export function Pitch() {
  const geometry = useMemo(() => new ShapeGeometry(roundedRect(BOWL.halfX, BOWL.halfZ, BOWL.radius), 24), [])
  const material = useMemo(() => createPitchMaterial(), [])
  const { halfLength: hl, halfWidth: hw } = PITCH

  return (
    <group>
      <mesh geometry={geometry} material={material} rotation-x={-Math.PI / 2} position-y={0.05} receiveShadow />
      <Goal side={1} />
      <Goal side={-1} />
      {[
        [hl, hw],
        [hl, -hw],
        [-hl, hw],
        [-hl, -hw],
      ].map(([x, z]) => (
        <CornerFlag key={`${x}${z}`} x={x} z={z} />
      ))}
    </group>
  )
}
