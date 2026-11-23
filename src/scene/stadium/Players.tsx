import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  type InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  OctahedronGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PITCH } from '../../config/stadium'
import { once } from '../../lib/once'
import { pixelUniforms } from '../pixelScale'
import { withLocalFill } from './materials'

/** Uma parte do jogador: aShorts = 1 no calção, aSkin = 1 no rosto; o resto leva a cor do uniforme. */
function part(geometry: BufferGeometry, shorts: number, skin: number) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  g.deleteAttribute('uv')
  const n = g.getAttribute('position').count
  g.setAttribute('aShorts', new BufferAttribute(new Float32Array(n).fill(shorts), 1))
  g.setAttribute('aSkin', new BufferAttribute(new Float32Array(n).fill(skin), 1))
  return g
}

/** Jogador simples (meião, calção, camisa e cabeça), de frente para +z, com os pés em y = 0. */
function createPlayerGeometry() {
  return mergeGeometries([
    part(new BoxGeometry(0.3, 0.5, 0.18).translate(0, 0.25, 0), 0, 0),
    part(new BoxGeometry(0.34, 0.42, 0.2).translate(0, 0.71, 0), 0, 1),
    part(new BoxGeometry(0.36, 0.28, 0.22).translate(0, 1.0, 0), 1, 0),
    part(new BoxGeometry(0.44, 0.52, 0.24).translate(0, 1.4, 0), 0, 0),
    part(new OctahedronGeometry(0.13, 0).translate(0, 1.82, 0.01), 0, 1),
  ])!
}

function createPlayerMaterial() {
  const material = withLocalFill(new MeshLambertMaterial(), 'players', 1.5)
  const previous = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer)
    Object.assign(shader.uniforms, pixelUniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uPixelAngle;\nattribute float aShorts;\nattribute float aSkin;\nvarying vec3 vKit;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // de longe o jogador (0,44 m) ficaria menor que um pixel e piscaria:
        // cresce na horizontal para ocupar pelo menos ~1,8 pixel, como as pessoas da esplanada
        vec4 playerView = modelViewMatrix * instanceMatrix * vec4(0.0, 0.9, 0.0, 1.0);
        transformed.xz *= clamp(1.8 * max(-playerView.z, 0.0) * uPixelAngle / 0.44, 1.0, 2.6);`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          vKit = mix(mix(instanceColor.rgb, vec3(0.93), aShorts), vec3(0.78, 0.55, 0.4), aSkin);
        #endif`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKit;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vKit;')
  }
  material.customProgramCacheKey = () => 'players'
  return material
}

type Motion =
  | { kind: 'jog'; cx: number; cz: number; rx: number; rz: number; period: number; phase: number }
  | { kind: 'pass'; x: number; z: number; facing: number; phase: number }
  | { kind: 'keeper'; x: number; facing: number; phase: number }

interface Player {
  color: string
  motion: Motion
}

const HOME = '#c8102e'
const AWAY = '#1d4ed8'

/** Os dois times aquecendo, cada um no seu campo: quatro trotando, dois tocando a bola e o goleiro. */
const getPlayers = once((): Player[] => {
  const players: Player[] = []
  for (const side of [-1, 1]) {
    const color = side < 0 ? HOME : AWAY
    for (let k = 0; k < 4; k++) {
      players.push({
        color,
        motion: { kind: 'jog', cx: side * 27, cz: 5, rx: 13, rz: 8, period: side < 0 ? 27 : 24, phase: k / 4 + (side < 0 ? 0 : 0.11) },
      })
    }
    const passX = side * 22
    players.push({ color, motion: { kind: 'pass', x: passX - 7, z: -15, facing: Math.PI / 2, phase: 0 } })
    players.push({ color, motion: { kind: 'pass', x: passX + 7, z: -15, facing: -Math.PI / 2, phase: 0.5 } })
    players.push({
      color: side < 0 ? '#f2c80f' : '#1fa35a',
      motion: { kind: 'keeper', x: side * (PITCH.halfLength - 2.5), facing: side < 0 ? Math.PI / 2 : -Math.PI / 2, phase: side < 0 ? 0 : 0.3 },
    })
  }
  return players
})

const getPlayerParts = once(() => ({ geometry: createPlayerGeometry(), material: createPlayerMaterial() }))

export function Players() {
  const ref = useRef<InstancedMesh>(null)
  const players = useMemo(() => getPlayers(), [])
  const parts = useMemo(() => getPlayerParts(), [])
  const dummy = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    const mesh = ref.current!
    const colors = new Float32Array(players.length * 3)
    const c = new Color()
    players.forEach((p, i) => c.set(p.color).toArray(colors, i * 3))
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3)
  }, [players])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    players.forEach((p, i) => {
      const m = p.motion
      let x: number
      let z: number
      let yaw: number
      let bob = 0
      if (m.kind === 'jog') {
        const a = (t / m.period + m.phase) * Math.PI * 2
        x = m.cx + Math.cos(a) * m.rx
        z = m.cz + Math.sin(a) * m.rz
        // rumo: tangente da volta
        yaw = Math.atan2(-Math.sin(a) * m.rx, Math.cos(a) * m.rz)
        bob = Math.abs(Math.sin(t * 8.5 + i)) * 0.06
      } else if (m.kind === 'pass') {
        // passo curto para os lados, esperando a bola
        x = m.x
        z = m.z + Math.sin((t / 3 + m.phase) * Math.PI * 2) * 0.6
        yaw = m.facing
      } else {
        // goleiro se deslocando na frente do gol
        x = m.x
        z = Math.sin((t / 5 + m.phase) * Math.PI * 2) * 2.6
        yaw = m.facing
        bob = Math.abs(Math.sin(t * 6 + i)) * 0.04
      }
      dummy.position.set(x, 0.05 + bob, z)
      dummy.rotation.set(0, yaw, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[parts.geometry, parts.material, players.length]} frustumCulled={false} />
}
