import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  type InstancedMesh,
  MeshLambertMaterial,
  Object3D,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PITCH } from '../../config/stadium'
import { once } from '../../lib/once'
import { withLocalFill } from './materials'
import { createSeatGeometry } from './seatGeometry'

// Bancos de reservas na lateral norte, um de cada lado do meio-campo, entre a
// linha lateral e as placas. Frente virada para o campo (+z).
const WIDTH = 7.2
const DEPTH = 2.2
const BACK_Z = -(PITCH.halfWidth + 4.6)
const FRONT_Z = BACK_Z + DEPTH
const SEATS = 11
const BENCHES = [
  { x: -7.5, color: '#c8102e' },
  { x: 7.5, color: '#1d4ed8' },
]

function colored(g: BufferGeometry, hex: string) {
  const flat = g.index ? g.toNonIndexed() : g
  flat.deleteAttribute('uv')
  const c = new Color(hex)
  const n = flat.getAttribute('position').count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) c.toArray(colors, i * 3)
  flat.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return flat
}

/** Estrutura de um banco: parede do fundo, laterais, cobertura e a faixa com a cor do time. */
function createShell(teamColor: string) {
  const h = 2.1
  return mergeGeometries([
    colored(new BoxGeometry(WIDTH, h, 0.12).translate(0, h / 2, BACK_Z + 0.06), '#262a31'),
    colored(new BoxGeometry(WIDTH, 0.22, 0.13).translate(0, 1.55, BACK_Z + 0.13), teamColor),
    colored(new BoxGeometry(0.1, h, DEPTH).translate(-WIDTH / 2, h / 2, BACK_Z + DEPTH / 2), '#30353d'),
    colored(new BoxGeometry(0.1, h, DEPTH).translate(WIDTH / 2, h / 2, BACK_Z + DEPTH / 2), '#30353d'),
    // perfil de alumínio na frente da cobertura transparente
    colored(new BoxGeometry(WIDTH + 0.1, 0.1, 0.1).translate(0, h + 0.05, FRONT_Z + 0.15), '#c9ccd1'),
    colored(new BoxGeometry(WIDTH - 0.3, 0.3, 0.4).translate(0, 0.15, BACK_Z + 0.55), '#3a3f48'),
  ])!
}

/** Linhas tracejadas da área técnica: 1 m para cada lado do banco e até 1 m da linha lateral. */
function createTechnicalArea() {
  const dash = 0.5
  const gap = 0.35
  const width = 0.1
  const parts: BufferGeometry[] = []
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    const length = Math.hypot(x1 - x0, z1 - z0)
    const dx = (x1 - x0) / length
    const dz = (z1 - z0) / length
    for (let s = 0; s < length; s += dash + gap) {
      const l = Math.min(dash, length - s)
      const cx = x0 + dx * (s + l / 2)
      const cz = z0 + dz * (s + l / 2)
      parts.push(new BoxGeometry(dx ? l : width, 0.004, dz ? l : width).translate(cx, 0.052, cz))
    }
  }
  const touch = -PITCH.halfWidth - 1
  for (const { x } of BENCHES) {
    const x0 = x - WIDTH / 2 - 1
    const x1 = x + WIDTH / 2 + 1
    line(x0, FRONT_Z, x0, touch)
    line(x1, FRONT_Z, x1, touch)
    line(x0, touch, x1, touch)
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!
}

const getDugoutParts = once(() => ({
  shells: mergeGeometries(BENCHES.map((b) => createShell(b.color).translate(b.x, 0.05, 0)))!,
  shellMaterial: withLocalFill(new MeshLambertMaterial({ vertexColors: true }), 'dugout', 1.2),
  // cobertura de policarbonato: dá para ver os bancos de cima
  roofMaterial: withLocalFill(
    new MeshLambertMaterial({ color: '#cfe3f2', transparent: true, opacity: 0.22, depthWrite: false }),
    'dugout-roof',
    1.4,
  ),
  roofs: mergeGeometries(
    BENCHES.map((b) => new BoxGeometry(WIDTH - 0.1, 0.03, DEPTH + 0.4).translate(b.x, 2.25, BACK_Z + DEPTH / 2 + 0.15)),
  )!,
  seat: createSeatGeometry(),
  seatMaterial: withLocalFill(new MeshLambertMaterial({ side: DoubleSide }), 'dugout-seats', 1.2),
  area: createTechnicalArea(),
  // linhas pintadas no gramado, com a mesma luz dos refletores das linhas do campo
  lineMaterial: withLocalFill(
    new MeshLambertMaterial({ color: '#f4f4f0', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    'dugout-lines',
    2.6,
  ),
}))

function Seats() {
  const ref = useRef<InstancedMesh>(null)
  const parts = useMemo(() => getDugoutParts(), [])
  useLayoutEffect(() => {
    const mesh = ref.current!
    const dummy = new Object3D()
    const colors = new Float32Array(BENCHES.length * SEATS * 3)
    const c = new Color()
    BENCHES.forEach((bench, b) => {
      for (let k = 0; k < SEATS; k++) {
        const i = b * SEATS + k
        dummy.position.set(bench.x + (k - (SEATS - 1) / 2) * 0.58, 0.05, BACK_Z + 0.75)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        c.set(bench.color).toArray(colors, i * 3)
      }
    })
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3)
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [])
  return <instancedMesh ref={ref} args={[parts.seat, parts.seatMaterial, BENCHES.length * SEATS]} />
}

export function Dugouts() {
  const parts = useMemo(() => getDugoutParts(), [])
  return (
    <group>
      <mesh geometry={parts.shells} material={parts.shellMaterial} />
      <Seats />
      <mesh geometry={parts.roofs} material={parts.roofMaterial} />
      <mesh geometry={parts.area} material={parts.lineMaterial} />
    </group>
  )
}
