import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  OctahedronGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PITCH } from '../../config/stadium'
import { once } from '../../lib/once'
import { mulberry32 } from '../../lib/random'
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

const HOME = '#c8102e'
const AWAY = '#1d4ed8'
const KEEPER = ['#f2c80f', '#1fa35a']
const BALL_R = 0.11
/** altura do gramado */
const GROUND = 0.05

/** Posição, rumo e balanço de um jogador neste quadro. */
interface Body {
  x: number
  z: number
  yaw: number
  lift: number
}

interface Ball {
  x: number
  y: number
  z: number
}

const ease = (u: number) => 1 - Math.pow(1 - Math.min(Math.max(u, 0), 1), 1.6)
const smooth = (a: number, b: number, v: number) => {
  const u = Math.min(Math.max((v - a) / (b - a), 0), 1)
  return u * u * (3 - 2 * u)
}
const face = (body: Body, x: number, z: number) => {
  body.yaw = Math.atan2(x - body.x, z - body.z)
}

/**
 * Roda de passes: quatro jogadores em losango tocando a bola entre si. Quem
 * vai receber dá um passo na direção da bola; todos acompanham a bola.
 */
class PassingSquare {
  spots: { x: number; z: number; nx: number; nz: number }[]
  pass = { from: 0, to: 2, start: 0, dur: 1 }
  rand: () => number
  constructor(cx: number, cz: number, radius: number, seed: number) {
    this.spots = [0, 1, 2, 3].map((k) => {
      // girada: vistos da lateral, dois jogadores não ficam um atrás do outro
      const a = (k * Math.PI) / 2 + 0.35
      return { x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius, nx: -Math.cos(a), nz: -Math.sin(a) }
    })
    this.rand = mulberry32(seed)
    this.pass.dur = this.duration(0, 2)
  }
  foot(i: number) {
    const s = this.spots[i]
    return { x: s.x + s.nx * 0.45, z: s.z + s.nz * 0.45 }
  }
  duration(a: number, b: number) {
    const fa = this.foot(a)
    const fb = this.foot(b)
    return Math.hypot(fb.x - fa.x, fb.z - fa.z) / 10 + 0.2
  }
  update(t: number, bodies: Body[], ball: Ball) {
    const HOLD = 0.5
    const p = this.pass
    while (t > p.start + p.dur + HOLD) {
      p.start += p.dur + HOLD
      const from = p.to
      // nunca devolve para quem acabou de passar (fica mais parecido com um treino)
      let to = from
      while (to === from || to === p.from) to = Math.floor(this.rand() * 4)
      p.from = from
      p.to = to
      p.dur = this.duration(from, to)
    }
    const u = (t - p.start) / p.dur
    const a = this.foot(p.from)
    const b = this.foot(p.to)
    const e = ease(u)
    ball.x = a.x + (b.x - a.x) * e
    ball.z = a.z + (b.z - a.z) * e
    ball.y = GROUND + BALL_R
    // passo do recebedor na direção da bola, voltando ao lugar depois de dominar
    const reach = smooth(0.5, 1, u) * (1 - smooth(0, 0.5, t - p.start - p.dur))
    this.spots.forEach((s, i) => {
      const body = bodies[i]
      const step = i === p.to ? reach * 0.7 : 0
      body.x = s.x + s.nx * step
      body.z = s.z + s.nz * step
      body.lift = 0
      face(body, ball.x, ball.z)
    })
  }
}

/**
 * Finalização: um jogador chuta, o goleiro vai na bola e defende, segura e
 * devolve com a mão por cima. Cada ciclo sorteia o canto e a altura do chute.
 */
class ShootingDrill {
  side: number
  shooter: { x: number; z: number }
  keeperX: number
  seed: number
  constructor(side: number, seed: number) {
    this.side = side
    this.shooter = { x: side * (PITCH.halfLength - 18), z: -2.5 }
    this.keeperX = side * (PITCH.halfLength - 0.9)
    this.seed = seed
  }
  update(t: number, shooter: Body, keeper: Body, ball: Ball) {
    const SHOT = 0.85
    const HOLD = 0.8
    const THROW = 1.5
    const SET = 1.2
    const cycle = SHOT + HOLD + THROW + SET
    const n = Math.floor(t / cycle)
    const tau = t - n * cycle
    const r = mulberry32(this.seed + n * 7919)
    const tz = (r() * 2 - 1) * 2.6
    const ty = 0.35 + r() * 1.3
    const side = this.side
    const foot = { x: this.shooter.x + side * 0.45, z: this.shooter.z }
    const hands = { x: this.keeperX - side * 0.4, y: ty, z: tz }

    let keeperZ = 0
    if (tau < SHOT) {
      // chute: a bola sobe um pouco e chega à altura sorteada
      const u = tau / SHOT
      ball.x = foot.x + (hands.x - foot.x) * u
      ball.z = foot.z + (hands.z - foot.z) * u
      ball.y = GROUND + BALL_R + (hands.y - BALL_R) * u + Math.sin(Math.PI * u) * 0.5
      keeperZ = tz * smooth(0.15, 0.85, u)
    } else if (tau < SHOT + HOLD) {
      ball.x = hands.x
      ball.y = hands.y
      ball.z = hands.z
      keeperZ = tz
    } else if (tau < SHOT + HOLD + THROW) {
      // devolve com a mão, por cima
      const u = (tau - SHOT - HOLD) / THROW
      ball.x = hands.x + (foot.x - hands.x) * u
      ball.z = hands.z + (foot.z - hands.z) * u
      ball.y = 1.6 + (GROUND + BALL_R - 1.6) * u + Math.sin(Math.PI * u) * 2.6
      keeperZ = tz * (1 - smooth(0.3, 1, u))
    } else {
      ball.x = foot.x
      ball.y = GROUND + BALL_R
      ball.z = foot.z
    }
    keeper.x = this.keeperX
    keeper.z = keeperZ
    // pula um pouco nas bolas altas
    keeper.lift = tau < SHOT + HOLD ? Math.max(0, ty - 1.1) * 0.6 * smooth(0.5, 1, tau / SHOT) * (1 - smooth(SHOT, SHOT + HOLD, tau)) : 0
    face(keeper, this.shooter.x, this.shooter.z)
    shooter.x = this.shooter.x
    shooter.z = this.shooter.z
    shooter.lift = 0
    // olha o gol para chutar e acompanha a bola na volta
    if (tau < SHOT || tau > SHOT + HOLD + THROW) face(shooter, side * PITCH.halfLength, 0)
    else face(shooter, ball.x, ball.z)
  }
}

/**
 * Dois jogadores fazendo tiros de corrida, cada um na sua raia e no seu
 * ritmo, virando nas pontas (antes corriam lado a lado, iguais, como uma dupla).
 */
class Runners {
  lanes: { cx: number; cz: number; length: number; speed: number; phase: number }[]
  constructor(cx: number, cz: number) {
    this.lanes = [
      { cx, cz, length: 14, speed: 4.6, phase: 0 },
      { cx: cx + 3, cz: cz + 7, length: 10, speed: 3.6, phase: 2.6 },
    ]
  }
  update(t: number, bodies: Body[]) {
    const width = 1.6
    bodies.forEach((body, i) => {
      const lane = this.lanes[i]
      const a = t * (lane.speed / lane.length) + lane.phase
      body.x = lane.cx + Math.cos(a) * lane.length
      body.z = lane.cz + Math.sin(a) * width
      const vx = -Math.sin(a) * lane.length
      const vz = Math.cos(a) * width
      body.yaw = Math.atan2(vx, vz)
      const speed = Math.hypot(vx, vz) / lane.length
      body.lift = Math.abs(Math.sin(t * (8 + i * 1.3) + i * 1.7)) * 0.07 * speed
    })
  }
}

interface Team {
  color: string
  keeper: string
  square: PassingSquare
  shooting: ShootingDrill
  runners: Runners
}

/**
 * Os dois times aquecendo, cada um no seu campo e com a sua bola: roda de
 * passes, finalização contra o goleiro e tiros de corrida (8 por time).
 */
const getTeams = once((): Team[] =>
  [-1, 1].map((side, k) => ({
    color: side < 0 ? HOME : AWAY,
    keeper: KEEPER[k],
    square: new PassingSquare(side * 20, -9, 5.5, 11 + k),
    shooting: new ShootingDrill(side, 101 + k * 37),
    runners: new Runners(side * 24, 17),
  })),
)

/** ordem dos jogadores na malha, por time: 4 da roda, o batedor, o goleiro e os 2 da corrida */
const PER_TEAM = 8

const getPlayerParts = once(() => ({
  geometry: createPlayerGeometry(),
  material: createPlayerMaterial(),
  ball: new IcosahedronGeometry(BALL_R, 1),
  ballMaterial: createBallMaterial(),
}))

/** Bola branca; de longe cresce até ~1,2 pixel, e na visão geral nem é desenhada. */
function createBallMaterial() {
  const material = withLocalFill(new MeshLambertMaterial({ color: '#f6f6f2' }), 'ball', 1.6)
  const previous = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer)
    Object.assign(shader.uniforms, pixelUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPixelAngle;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 ballView = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        transformed *= clamp(1.2 * max(-ballView.z, 0.0) * uPixelAngle / ${(2 * BALL_R).toFixed(2)}, 1.0, 4.0);`,
      )
  }
  material.customProgramCacheKey = () => 'ball'
  return material
}

/** a partir desta distância da câmera ao centro as bolas não são desenhadas (visão geral) */
const BALLS_WITHIN = 420

export function Players() {
  const ref = useRef<InstancedMesh>(null)
  const balls = useRef<InstancedMesh>(null)
  const teams = useMemo(() => getTeams(), [])
  const parts = useMemo(() => getPlayerParts(), [])
  const scratch = useMemo(() => {
    const bodies = Array.from({ length: teams.length * PER_TEAM }, (): Body => ({ x: 0, z: 0, yaw: 0, lift: 0 }))
    // grupos de cada exercício, montados uma vez (nada é alocado por quadro)
    const groups = teams.map((_, k) => {
      const b = bodies.slice(k * PER_TEAM, (k + 1) * PER_TEAM)
      return { square: b.slice(0, 4), shooter: b[4], keeper: b[5], runners: b.slice(6, 8) }
    })
    const balls = Array.from({ length: teams.length * 2 }, (): Ball => ({ x: 0, y: 0, z: 0 }))
    return { dummy: new Object3D(), bodies, groups, balls }
  }, [teams])

  useLayoutEffect(() => {
    const mesh = ref.current!
    const colors = new Float32Array(teams.length * PER_TEAM * 3)
    const c = new Color()
    teams.forEach((team, k) => {
      for (let i = 0; i < PER_TEAM; i++) c.set(i === 5 ? team.keeper : team.color).toArray(colors, (k * PER_TEAM + i) * 3)
    })
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3)
  }, [teams])

  useFrame((state) => {
    const mesh = ref.current
    const ballMesh = balls.current
    if (!mesh || !ballMesh) return
    const t = state.clock.elapsedTime
    const { dummy, bodies, groups } = scratch
    teams.forEach((team, k) => {
      const g = groups[k]
      team.square.update(t, g.square, scratch.balls[k * 2])
      team.shooting.update(t, g.shooter, g.keeper, scratch.balls[k * 2 + 1])
      team.runners.update(t, g.runners)
    })
    bodies.forEach((body, i) => {
      dummy.position.set(body.x, GROUND + body.lift, body.z)
      dummy.rotation.set(0, body.yaw, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true

    ballMesh.visible = state.camera.position.length() < BALLS_WITHIN
    if (!ballMesh.visible) return
    dummy.rotation.set(0, 0, 0)
    scratch.balls.forEach((ball, i) => {
      dummy.position.set(ball.x, ball.y, ball.z)
      dummy.updateMatrix()
      ballMesh.setMatrixAt(i, dummy.matrix)
    })
    ballMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={ref} args={[parts.geometry, parts.material, teams.length * PER_TEAM]} frustumCulled={false} />
      <instancedMesh ref={balls} args={[parts.ball, parts.ballMaterial, teams.length * 2]} frustumCulled={false} />
    </group>
  )
}
