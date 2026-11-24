import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import { BOWL, ROOF } from '../../config/stadium'
import { mulberry32 } from '../../lib/random'
import { useExperience } from '../../store/experience'
import { setFlash } from '../lighting'

const FALLBACK = new Color()

/** Tempo de subida do foguete até estourar (s). */
const RISE = 1.35
const ROOF_Y = ROOF.innerY

/** Lançamentos durante a abertura (s desde o início), terminando num final rápido. */
const LAUNCHES = [0.4, 0.9, 1.5, 2.0, 2.6, 3.1, 3.7, 4.2, 4.8, 5.3, 5.9, 6.4, 6.8, 6.95, 7.1, 7.25, 7.4]

const PALETTE = ['#ff2440', '#ffd27a', '#3d6dff', '#e23dff', '#ffffff', '#2fe0ff', '#7dff6a', '#ff8a2a']

type Kind = 1 | 2 | 3 // esfera, anel, chorão

const vertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute vec4 aStart;
attribute vec4 aVel;
attribute vec3 aColor;
attribute vec2 aShape;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float t = uTime - aStart.x;
  float kind = aStart.w;
  vec3 origin = vec3(aStart.y, ${ROOF_Y.toFixed(1)}, aStart.z);
  vec3 pos = origin;
  float alpha = 0.0;
  float size = 0.0;

  if (kind < 0.5) {
    // rastro do foguete: as partículas seguem a cabeça com um pequeno atraso
    float tt = t - aVel.w * 0.2;
    if (tt > 0.0 && tt < ${RISE.toFixed(2)}) {
      float k = tt / ${RISE.toFixed(2)};
      pos += vec3(sin(k * 9.0 + aStart.y) * 0.5, aShape.x * (1.0 - (1.0 - k) * (1.0 - k)), cos(k * 7.0) * 0.5);
      alpha = (1.0 - aVel.w) * 0.85;
      size = mix(1.4, 0.4, aVel.w);
    }
  } else {
    float a = t - ${RISE.toFixed(2)};
    float life = aShape.y;
    if (a > 0.0 && a < life) {
      bool willow = kind > 2.5;
      float drag = willow ? 0.9 : 1.6;
      vec3 top = origin + vec3(0.0, aShape.x, 0.0);
      pos = top + aVel.xyz * (1.0 - exp(-drag * a)) / drag;
      pos.y -= (willow ? 3.4 : 2.2) * a * a;
      float fade = 1.0 - a / life;
      float sparkle = 0.55 + 0.45 * sin(a * 40.0 + aVel.w * 70.0);
      alpha = fade * fade * (a < 0.1 ? 2.2 : 1.0) * (fade < 0.4 ? sparkle : 1.0);
      size = mix(0.7, 1.7, fade);
    }
  }

  vColor = aColor;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, size * uScale / max(1.0, -mv.z));
  if (alpha <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  }
}
`

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float glow = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vColor * 2.4, glow * glow * vAlpha);
}
`

interface Burst {
  launch: number
  x: number
  z: number
  height: number
  color: Color
  kind: Kind
}

function planBursts(): Burst[] {
  const rand = mulberry32(31)
  return LAUNCHES.map((launch, i) => {
    // saem da borda interna da cobertura, em volta do estádio
    const a = rand() * Math.PI * 2
    const rx = BOWL.halfX + ROOF.inner - 4
    const rz = BOWL.halfZ + ROOF.inner - 4
    const kind: Kind = i >= LAUNCHES.length - 5 ? (i % 2 ? 1 : 3) : rand() < 0.55 ? 1 : rand() < 0.5 ? 2 : 3
    // as cores se alternam para todas aparecerem ao longo da abertura
    const color = new Color(kind === 3 ? '#ffc35c' : PALETTE[i % PALETTE.length])
    return { launch, x: Math.cos(a) * rx * 0.8, z: Math.sin(a) * rz * 0.8, height: 58 + rand() * 38, color, kind }
  })
}

function buildGeometry(bursts: Burst[]) {
  const rand = mulberry32(77)
  const start: number[] = []
  const vel: number[] = []
  const color: number[] = []
  const shape: number[] = []
  const push = (b: Burst, kind: number, v: [number, number, number], seed: number, life: number, tint = b.color) => {
    start.push(b.launch, b.x, b.z, kind)
    vel.push(v[0], v[1], v[2], seed)
    color.push(tint.r, tint.g, tint.b)
    shape.push(b.height, life)
  }
  const white = new Color('#fff4e0')
  for (const b of bursts) {
    for (let i = 0; i < 28; i++) push(b, 0, [0, 0, 0], i / 28, 0, white)
    const count = b.kind === 3 ? 240 : 210
    // plano do anel inclinado ao acaso
    const tilt = rand() * Math.PI
    for (let i = 0; i < count; i++) {
      let dx: number
      let dy: number
      let dz: number
      if (b.kind === 2) {
        const a = (i / count) * Math.PI * 2
        dx = Math.cos(a)
        dy = Math.sin(a) * Math.cos(tilt)
        dz = Math.sin(a) * Math.sin(tilt)
      } else {
        // direção uniforme na esfera
        const u = rand() * 2 - 1
        const a = rand() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        dx = r * Math.cos(a)
        dy = u
        dz = r * Math.sin(a)
      }
      const speed = (b.kind === 3 ? 50 : 80) * (0.86 + rand() * 0.14)
      const life = b.kind === 3 ? 3.2 + rand() * 0.6 : 2.0 + rand() * 0.5
      // algumas faíscas puxam para o branco, dando brilho ao centro
      const tint = rand() < 0.15 ? b.color.clone().lerp(white, 0.6) : b.color
      const seed = rand()
      const v: [number, number, number] = [dx * speed, dy * speed, dz * speed]
      push(b, b.kind, v, seed, life, tint)
      // duas cópias atrasadas e mais fracas formam o rastro da faísca
      for (const [lag, dim] of [
        [0.05, 0.45],
        [0.1, 0.2],
      ]) {
        push({ ...b, launch: b.launch + lag }, b.kind, v, seed, life, tint.clone().multiplyScalar(dim))
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(start.length / 4 * 3), 3))
  g.setAttribute('aStart', new BufferAttribute(new Float32Array(start), 4))
  g.setAttribute('aVel', new BufferAttribute(new Float32Array(vel), 4))
  g.setAttribute('aColor', new BufferAttribute(new Float32Array(color), 3))
  g.setAttribute('aShape', new BufferAttribute(new Float32Array(shape), 2))
  return g
}

/** Fogos de artifício sobre o estádio durante a abertura. */
export function Fireworks() {
  const phase = useExperience((s) => s.phase)
  const orderId = useExperience((s) => s.order?.id ?? '')
  const celebrated = useRef('')
  const { bursts, geometry, material } = useMemo(() => {
    const bursts = planBursts()
    return {
      bursts,
      geometry: buildGeometry(bursts),
      material: new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uTime: { value: -1 }, uScale: { value: 1000 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    }
  }, [])
  const points = useRef<Points>(null)
  const clock = useRef(-1)
  const flashPos = useRef(new Vector3())
  const lastBurst = useMemo(() => bursts.reduce((t, b) => Math.max(t, b.launch + RISE + 4), 0), [bursts])

  useFrame((state, delta) => {
    if (clock.current < 0 && phase === 'intro') clock.current = 0
    // compra confirmada: os fogos estouram de novo, uma vez por compra
    if (phase === 'done' && celebrated.current !== orderId) {
      celebrated.current = orderId
      clock.current = 0
    }
    if (clock.current < 0) return
    clock.current += Math.min(delta, 0.1)
    const t = clock.current
    const done = t > lastBurst

    const camera = state.camera as PerspectiveCamera
    const fov = (camera.fov * Math.PI) / 180
    if (points.current) {
      const shader = points.current.material as ShaderMaterial
      shader.uniforms.uTime.value = t
      shader.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(fov / 2))
      points.current.visible = !done
    }

    // clarão do estouro mais recente, na cor dele (aplicado direto nos materiais)
    let intensity = 0
    let color: Color | null = null
    for (const b of bursts) {
      const age = t - b.launch - RISE
      if (age >= 0 && age < 0.9) {
        const value = 70000 * Math.exp(-age * 5.5)
        if (value > intensity) {
          intensity = value
          color = b.color
          flashPos.current.set(b.x, ROOF_Y + b.height, b.z)
        }
      }
    }
    setFlash(done || !color ? null : flashPos.current, color ?? FALLBACK, intensity)
  })

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
