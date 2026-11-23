import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { once } from '../../lib/once'
import { canvasTexture } from '../../lib/textures'
import { outside } from '../outside'
import { drawGithub } from '../stadium/ledContent'

const LENGTH = 52
const RADIUS = 6.8
/**
 * Volta em torno do estádio: elipse que cabe na visão geral (o dirigível
 * aparece no quadro quase o tempo todo), altura e duração (s). Começa atrás
 * do estádio, visto da câmera no início da abertura.
 */
const ORBIT = { rx: 185, rz: 120, height: 125, period: 210, start: -1.0 }

/** Raio do envelope em t (0 = nariz, 1 = cauda): nariz cheio e cauda afinando. */
const radiusAt = (t: number) => RADIUS * Math.pow(Math.sin(Math.PI * Math.min(Math.max(t, 0.001), 0.999)), 0.62) * (1 - 0.18 * t)
/** posição x de t (o nariz fica em +x) */
const xAt = (t: number) => LENGTH / 2 - t * LENGTH

function createEnvelope() {
  const along = 40
  const around = 28
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= along; i++) {
    const t = i / along
    const r = radiusAt(t)
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2
      positions.push(xAt(t), r * Math.cos(a), r * Math.sin(a))
    }
  }
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j
      const b = a + around + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/**
 * Faixa com o texto sobre o envelope, num lado (+1 = +z, -1 = -z) ou em cima
 * (0). O UV é montado para o texto ser lido de quem olha aquele lado.
 */
function createBand(side: 1 | -1 | 0) {
  const t0 = 0.17
  const t1 = 0.78
  const half = side === 0 ? 0.42 : 0.36
  const center = side === 0 ? 0 : side > 0 ? Math.PI / 2 : (3 * Math.PI) / 2
  const along = 24
  const across = 6
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= along; i++) {
    const t = t0 + ((t1 - t0) * i) / along
    const r = radiusAt(t) + 0.06
    // da esquerda para a direita de quem olha o lado (+z: x cresce; -z: x diminui)
    const u = side < 0 ? i / along : 1 - i / along
    for (let k = 0; k <= across; k++) {
      // de cima para baixo de quem olha (+z: cos maior em cima)
      const a = side > 0 ? center - half + (2 * half * k) / across : center + half - (2 * half * k) / across
      positions.push(xAt(t), r * Math.cos(a), r * Math.sin(a))
      uvs.push(side === 0 ? 1 - u : u, 1 - k / across)
    }
  }
  for (let i = 0; i < along; i++) {
    for (let k = 0; k < across; k++) {
      const a = i * (across + 1) + k
      const b = a + across + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  return g
}

/** Faixa escura com a marca do GitHub e o endereço, entre dois filetes laranja. */
function drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ff5a1f'
  ctx.fillRect(0, h * 0.06, w, h * 0.05)
  ctx.fillRect(0, h * 0.89, w, h * 0.05)
  drawGithub(ctx, w / 2, h / 2, h * 0.34, w * 0.9, '#ffffff', '#aeb6c2')
}

const getBlimpParts = once(() => {
  const banner = canvasTexture(1536, 256, drawBanner)
  const fins = mergeGeometries(
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) =>
      new BoxGeometry(7, 0.25, 4.2)
        .translate(-LENGTH / 2 + 4.6, 0, radiusAt(0.88) + 1.6)
        .rotateX(a),
    ),
  )!
  return {
    banner,
    envelope: createEnvelope(),
    bands: mergeGeometries([createBand(1), createBand(-1), createBand(0)])!,
    // aletas da cauda e a cabine presa embaixo do envelope, na parte da frente
    hull: mergeGeometries([fins, new BoxGeometry(7, 2.1, 2.6).translate(4, -radiusAt(0.42) - 0.75, 0)])!,
    windows: new BoxGeometry(5.6, 0.5, 2.64).translate(4.2, -radiusAt(0.42) - 0.5, 0),
    // envelope prateado, com a luz de dentro (dirigíveis de propaganda são iluminados à noite)
    skin: new MeshLambertMaterial({ color: '#eef1f6', emissive: '#7d8aa6', emissiveIntensity: 0.75 }),
    bandMaterial: new MeshBasicMaterial({ map: banner, color: '#ffffff', side: DoubleSide }),
    dark: new MeshLambertMaterial({ color: '#2b3038', emissive: '#151a22' }),
    windowMaterial: new MeshBasicMaterial({ color: '#ffd9a0' }),
  }
})

/** Dirigível de propaganda com o GitHub do autor, dando a volta devagar em torno do estádio. */
export function Blimp() {
  const parts = useMemo(() => getBlimpParts(), [])
  const ref = useRef<Group>(null)

  useEffect(() => {
    // redesenha a faixa quando a fonte terminar de carregar
    document.fonts?.ready.then(() => {
      const { banner } = getBlimpParts()
      const canvas = banner.image as HTMLCanvasElement
      drawBanner(canvas.getContext('2d')!, canvas.width, canvas.height)
      banner.needsUpdate = true
    })
  }, [])

  useFrame((state) => {
    const group = ref.current
    if (!group) return
    group.visible = outside.visible
    if (!group.visible) return
    const a = ORBIT.start + (state.clock.elapsedTime / ORBIT.period) * Math.PI * 2
    group.position.set(Math.cos(a) * ORBIT.rx, ORBIT.height + Math.sin(a * 3) * 2, Math.sin(a) * ORBIT.rz)
    // nariz na direção da volta (tangente da elipse), com uma leve inclinação
    group.rotation.set(0, Math.atan2(-Math.cos(a) * ORBIT.rz, -Math.sin(a) * ORBIT.rx), 0.03)
  })

  return (
    <group ref={ref}>
      <mesh geometry={parts.envelope} material={parts.skin} />
      <mesh geometry={parts.bands} material={parts.bandMaterial} />
      <mesh geometry={parts.hull} material={parts.dark} />
      <mesh geometry={parts.windows} material={parts.windowMaterial} />
    </group>
  )
}
