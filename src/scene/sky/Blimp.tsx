import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  type Camera,
  DoubleSide,
  Float32BufferAttribute,
  Frustum,
  type Group,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Sphere,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { once } from '../../lib/once'
import { canvasTexture } from '../../lib/textures'
import { introDisabled, useExperience } from '../../store/experience'
import { INTRO_START } from '../cameraPoses'
import { outside } from '../outside'
import { drawGithub } from '../stadium/ledContent'

const LENGTH = 52
const RADIUS = 6.8
/**
 * Volta em torno do estádio: elipse que cabe na visão geral (o dirigível
 * aparece no quadro quase o tempo todo), altura e duração da volta (s).
 */
const ORBIT = { rx: 185, rz: 120, height: 128, period: 180 }
const ORBIT_SPEED = (Math.PI * 2) / ORBIT.period
/** raio que envolve o dirigível inteiro, para saber se ele está fora da tela */
const BLIMP_RADIUS = 30

/**
 * Começo da abertura: o dirigível passa perto da câmera, com a faixa do
 * GitHub virada para ela, no alto da tela (o título fica embaixo).
 * - share: fração da largura da tela ocupada pelo dirigível (nas telas
 *   estreitas ele passa da largura, cortando o nariz e a cauda, para o texto
 *   da faixa ficar grande o bastante para ler)
 * - drift: quanto da largura da tela ele anda por segundo
 * - from: onde a faixa começa, em fração da largura (negativo = à esquerda)
 * - height: altura na tela, em fração da meia altura acima do centro
 */
const FLYBY = { wideShare: 0.42, narrowShare: 1.15, drift: 0.05, from: -0.12, height: 0.46 }
/** Posição e velocidade (m/s) no ângulo `a` da volta em torno do estádio. */
function orbitAt(a: number, position: Vector3, velocity: Vector3) {
  const w = ORBIT_SPEED
  position.set(Math.cos(a) * ORBIT.rx, ORBIT.height + Math.sin(a * 3) * 2, Math.sin(a) * ORBIT.rz)
  velocity.set(-Math.sin(a) * ORBIT.rx * w, Math.cos(a * 3) * 6 * w, Math.cos(a) * ORBIT.rz * w)
}

/** Como o dirigível entra na volta: reta de chegada e o ângulo em que encaixa na elipse. */
interface Entry {
  /** ângulo da elipse onde a reta encosta (pela tangente) */
  angle: number
  /** direção (horizontal) e velocidade da reta de chegada */
  direction: Vector3
  speed: number
  /** comprimento da reta (m) e o instante em que ela começa */
  length: number
  start: number
}

const entryScratch = {
  frustum: new Frustum(),
  matrix: new Matrix4(),
  sphere: new Sphere(new Vector3(), BLIMP_RADIUS),
  point: new Vector3(),
  velocity: new Vector3(),
}

/**
 * Escolhe por onde o dirigível entra na tela: para cada ponto da elipse que
 * aparece na tela, recua pela tangente até sair do quadro; fica o que tem a
 * reta mais curta. Ele surge logo depois, já na direção da volta, e encaixa
 * nela sem virar (antes, uma curva longa o trazia de fora e terminava virando
 * no sentido contrário).
 */
function planEntry(camera: Camera, now: number, entry: Entry) {
  const { frustum, matrix, sphere, point, velocity } = entryScratch
  frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
  let best = -1
  let bestLength = Infinity
  const steps = 48
  for (let k = 0; k < steps; k++) {
    const angle = (k / steps) * Math.PI * 2
    orbitAt(angle, point, velocity)
    sphere.center.copy(point)
    if (!frustum.intersectsSphere(sphere)) continue
    velocity.setY(0).normalize()
    let length = 0
    while (length < 700 && frustum.intersectsSphere(sphere)) {
      length += 5
      sphere.center.copy(point).addScaledVector(velocity, -length)
    }
    if (length < bestLength) {
      bestLength = length
      best = angle
    }
  }
  if (best < 0) best = 0
  orbitAt(best, point, velocity)
  entry.angle = best
  entry.speed = Math.hypot(velocity.x, velocity.z)
  entry.direction.copy(velocity).setY(0).normalize()
  entry.length = Number.isFinite(bestLength) ? bestLength : 0
  entry.start = now
}

/**
 * Passagem da abertura, calculada a partir da pose inicial da câmera: o
 * dirigível fica a uma distância em que ocupa uma boa parte da largura da tela
 * e anda devagar para a direita.
 */
function flybyStart(aspect: number) {
  const { az, el, dist, tx, ty, tz, fov } = INTRO_START
  const camera = new Vector3(tx + dist * Math.cos(el) * Math.sin(az), ty + dist * Math.sin(el), tz + dist * Math.cos(el) * Math.cos(az))
  const forward = new Vector3(tx, ty, tz).sub(camera).normalize()
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize()
  const up = new Vector3().crossVectors(right, forward).normalize()
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  // de 0,8 (celular em pé) a 1,3 de proporção, passa de "maior que a tela" para "42% da tela"
  const share = MathUtils.lerp(FLYBY.narrowShare, FLYBY.wideShare, MathUtils.smoothstep(aspect, 0.8, 1.3))
  const distance = Math.max(LENGTH / (share * 2 * t * aspect), 70)
  const visibleWidth = 2 * t * aspect * distance
  const position = camera
    .clone()
    .addScaledVector(forward, distance)
    .addScaledVector(up, distance * t * FLYBY.height)
    .addScaledVector(right, FLYBY.from * visibleWidth)
  return { position, velocity: right.setY(0).normalize().multiplyScalar(FLYBY.drift * visibleWidth) }
}

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

  // abertura: passagem perto da câmera; depois, entra na tela e segue a volta em torno do estádio
  const motion = useRef({
    mode: 'none' as 'none' | 'flyby' | 'waiting' | 'entering',
    flybyFrom: new Vector3(),
    flybyVelocity: new Vector3(),
    flybyStart: -1,
    entry: { angle: 0, direction: new Vector3(1, 0, 0), speed: 1, length: 0, start: 0 } as Entry,
    position: new Vector3(),
    velocity: new Vector3(),
  })

  useFrame((state) => {
    const group = ref.current
    if (!group) return
    const m = motion.current
    const t = state.clock.elapsedTime
    const { phase, introSkipped } = useExperience.getState()
    // a câmera já chegou à visão geral (fim da abertura, ou abertura pulada)
    const settled = phase !== 'loading' && phase !== 'intro'

    if (m.mode === 'none') {
      if (!settled && !introSkipped && !introDisabled) {
        const start = flybyStart(state.size.width / state.size.height)
        m.flybyFrom.copy(start.position)
        m.flybyVelocity.copy(start.velocity)
        m.mode = 'flyby'
      } else m.mode = 'waiting'
    }
    if (m.mode === 'flyby') {
      // parado até a abertura da câmera começar (a tela ainda está preta)
      if (phase === 'intro' && m.flybyStart < 0) m.flybyStart = t
      m.position.copy(m.flybyFrom).addScaledVector(m.flybyVelocity, m.flybyStart < 0 ? 0 : t - m.flybyStart)
      m.velocity.copy(m.flybyVelocity)
      // na visão geral ele está fora do quadro: passa para a entrada na volta
      if (settled) m.mode = 'waiting'
    }
    if (m.mode === 'waiting') {
      if (!settled) {
        group.visible = false
        return
      }
      planEntry(state.camera, t, m.entry)
      m.mode = 'entering'
    }
    if (m.mode === 'entering') {
      const e = m.entry
      const travelled = (t - e.start) * e.speed
      if (travelled < e.length) {
        // reta de chegada, que encosta na elipse pela tangente
        orbitAt(e.angle, m.position, m.velocity)
        m.position.addScaledVector(e.direction, travelled - e.length)
        m.velocity.copy(e.direction).multiplyScalar(e.speed)
      } else {
        orbitAt(e.angle + (travelled - e.length) / e.speed * ORBIT_SPEED, m.position, m.velocity)
      }
    }

    group.visible = outside.visible
    if (!group.visible) return
    group.position.copy(m.position)
    // nariz na direção do movimento, com uma leve inclinação
    group.rotation.set(0, Math.atan2(-m.velocity.z, m.velocity.x), 0.03)
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
