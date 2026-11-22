import { useMemo } from 'react'
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
} from 'three'
import { BOWL, PITCH } from '../../config/stadium'
import { canvasTexture, getNoiseTexture } from '../../lib/textures'
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
  const material = new MeshStandardMaterial({ roughness: 0.94, metalness: 0 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNoise = { value: getNoiseTexture() }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPitch;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPitch = vec2(position.x, -position.y);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${pitchShaderChunk}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = pitchColor(vPitch);')
  }
  material.customProgramCacheKey = () => 'pitch'
  return material
}

function createNetGeometry() {
  const w = PITCH.goalHalfWidth
  const h = PITCH.goalHeight
  const topDepth = 0.9
  const depth = 2.1
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

function Goal({ side }: { side: 1 | -1 }) {
  const { net, netMaterial } = useMemo(() => {
    const map = canvasTexture(
      64,
      64,
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(0, h / 2)
        ctx.lineTo(w / 2, 0)
        ctx.lineTo(w, h / 2)
        ctx.lineTo(w / 2, h)
        ctx.closePath()
        ctx.stroke()
      },
      { repeat: true, srgb: true },
    )
    return {
      net: createNetGeometry(),
      netMaterial: new MeshStandardMaterial({
        map,
        alphaTest: 0.35,
        transparent: false,
        alphaToCoverage: true,
        side: DoubleSide,
        roughness: 0.8,
        color: '#f4f4f4',
      }),
    }
  }, [])

  const w = PITCH.goalHalfWidth + 0.06
  const h = PITCH.goalHeight
  const x = side * (PITCH.halfLength + 0.06)
  return (
    <group position-x={x} scale-x={side}>
      {[-w, w].map((z) => (
        <mesh key={z} position={[0, h / 2, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, h + 0.06, 12]} />
          <meshStandardMaterial color="#f7f7f5" roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.03, 0]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.06, 0.06, w * 2 + 0.12, 12]} />
        <meshStandardMaterial color="#f7f7f5" roughness={0.3} />
      </mesh>
      <mesh geometry={net} material={netMaterial} castShadow />
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
  const material = useMemo(createPitchMaterial, [])
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
