import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { getBlockInfo } from '../lib/blocks'
import { getSkyboxes } from '../lib/skyboxes'
import { introDisabled, type Phase, useExperience } from '../store/experience'
import {
  aerialPose,
  blockPose,
  boxEye,
  boxPose,
  type Eye,
  INTRO_START,
  INTRO_SWEEP,
  type Pose,
  seatEye,
  seatPose,
  sectorPose,
} from './cameraPoses'
import { cameraState } from './cameraState'
import { outside } from './outside'
import { outsideFog } from './outsideFog'

/** Diferença entre dois ângulos, no intervalo [-π, π]: a câmera sempre gira pelo lado mais curto. */
function angleDelta(from: number, to: number) {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
}

interface Selection {
  block: number
  box: number
  seat: number
}

/** Pose (em órbita) de cada etapa da escolha para a proporção de tela atual. */
function poseFor(phase: Phase, sel: Selection, aspect: number, out?: Pose) {
  if (phase === 'sector' && sel.block >= 0) return sectorPose(getBlockInfo(sel.block), aspect, out)
  if (phase === 'block' && sel.block >= 0) return blockPose(getBlockInfo(sel.block), aspect, out)
  if (phase === 'seat' && sel.seat >= 0) return seatPose(sel.seat, aspect, out)
  if (phase === 'box' && sel.box >= 0) return boxPose(getSkyboxes()[sel.box], aspect, out)
  return aerialPose(aspect, out)
}

/** Duração (s) de cada passagem entre etapas. */
function transitionDuration(from: Phase, to: Phase) {
  // de um camarote para o vizinho
  if (from === 'box' && to === 'box') return 1.3
  if (to === 'box') return from === 'aerial' ? 2.8 : 2
  if (from === 'box') return to === 'aerial' ? 2.5 : 1.9
  if (to === 'seat') return from === 'block' ? 1.8 : 2.2
  if (from === 'seat' && to === 'block') return 1.6
  if (to === 'block') return 2
  if (to === 'aerial') return from === 'seat' || from === 'pov' ? 3.2 : 2.3
  if (from === 'block') return 1.7
  // de um bloco para outro dentro da vista de setor
  if (from === 'sector') return 1.5
  // da visão geral até o setor: a descida mais longa
  return 2.6
}

/** etapas em que a câmera fica parada numa pose em órbita */
const navigable = (phase: Phase) =>
  phase === 'aerial' || phase === 'sector' || phase === 'block' || phase === 'seat' || phase === 'box'
/** etapas que posicionam a câmera (no pagamento e no ingresso ela fica onde estava) */
const placesCamera = (phase: Phase) => navigable(phase) || phase === 'pov'

const UP = new Vector3(0, 1, 0)

export function CameraRig() {
  const get = useThree((s) => s.get)
  const phase = useExperience((s) => s.phase)
  const selectedBlock = useExperience((s) => s.selectedBlock)
  const selectedBox = useExperience((s) => s.selectedBox)
  const selectedSeat = useExperience((s) => s.selectedSeat)
  const introSkipped = useExperience((s) => s.introSkipped)
  const setPhase = useExperience((s) => s.setPhase)

  const rig = useRef<Pose>({ ...(introDisabled ? aerialPose(1.6) : INTRO_START) })
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const transition = useRef<gsap.core.Animation | null>(null)
  const previous = useRef<{ phase: Phase } & Selection>({ phase, block: selectedBlock, box: selectedBox, seat: selectedSeat })
  const motion = useRef({ parallaxX: 0, parallaxY: 0, idle: 0, parallax: 1 })
  const view = useRef({ shift: 0, width: 0, height: 0 })
  const settled = useRef(aerialPose(1.6))
  // primeira pessoa (vista da cadeira): olho, olhar em volta arrastando e o balanço parado
  const eye = useRef<Eye & { active: boolean; near: number }>({ active: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 50, near: 0.12 })
  const look = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, lastInput: -1e9, sway: 0 })
  const scratch = useRef({ position: new Vector3(), direction: new Vector3() })

  useEffect(() => {
    if (phase !== 'intro') return
    const { width, height } = get().size
    const tl = gsap.timeline({ onComplete: () => setPhase('aerial') })
    // a câmera segura um instante no começo, para o dirigível passar com o GitHub à vista
    tl.to(rig.current, { ...INTRO_SWEEP, duration: 6, ease: 'power1.inOut' }, 1.6)
    tl.to(rig.current, { ...aerialPose(width / height), duration: 3.2, ease: 'power3.inOut' }, '-=0.9')
    timeline.current = tl
    return () => {
      tl.kill()
    }
  }, [phase, setPhase, get])

  useEffect(() => {
    if (!introSkipped || phase !== 'intro') return
    timeline.current?.kill()
    const { width, height } = get().size
    const tween = gsap.to(rig.current, {
      ...aerialPose(width / height),
      duration: 1.8,
      ease: 'power3.inOut',
      onComplete: () => setPhase('aerial'),
    })
    return () => {
      tween.kill()
    }
  }, [introSkipped, phase, setPhase, get])

  // passagens entre as etapas (no pagamento e no ingresso a câmera fica onde está)
  useEffect(() => {
    if (!placesCamera(phase)) return
    const from = previous.current
    const sel: Selection = { block: selectedBlock, box: selectedBox, seat: selectedSeat }
    previous.current = { phase, ...sel }
    if (!placesCamera(from.phase)) return
    if (from.phase === phase && from.block === sel.block && from.box === sel.box && from.seat === sel.seat) return

    const { width, height } = get().size
    const aspect = width / height
    const camera = get().camera as PerspectiveCamera
    const pose = rig.current
    const e = eye.current
    const l = look.current
    const m = motion.current
    transition.current?.kill()
    cameraState.povReady = false

    // Câmera atual em primeira pessoa (posição, rumo e inclinação do olhar).
    const fromCamera = () => {
      const { direction } = scratch.current
      camera.getWorldDirection(direction)
      e.x = camera.position.x
      e.y = camera.position.y
      e.z = camera.position.z
      e.yaw = Math.atan2(direction.x, direction.z)
      e.pitch = Math.asin(MathUtils.clamp(direction.y, -1, 1))
      e.fov = camera.fov
      e.near = camera.near
    }
    // A direção lida acima já inclui o quanto a pessoa virou o olhar
    // arrastando (e o passeio do olhar parado): zera esses desvios para não
    // somá-los de novo.
    const resetLook = () => Object.assign(l, { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, lastInput: -1e9, sway: 0 })

    if (phase === 'pov') {
      // Até os olhos de quem senta no lugar (cadeira ou camarote): a câmera
      // desce até lá enquanto vira para o campo, como quem se senta.
      if (!e.active) fromCamera()
      e.active = true
      cameraState.pov = true
      resetLook()
      const box = useExperience.getState().povKind === 'box'
      const to = box ? boxEye(getSkyboxes()[sel.box], aspect) : seatEye(sel.seat, aspect)
      const tl = gsap.timeline({
        onComplete: () => {
          transition.current = null
          cameraState.povReady = true
        },
      })
      tl.to(e, { x: to.x, y: to.y, z: to.z, near: 0.12, duration: 1.9, ease: 'power2.inOut' }, 0)
      tl.to(e, { yaw: e.yaw + angleDelta(e.yaw, to.yaw), pitch: to.pitch, duration: 2.1, ease: 'power2.inOut' }, 0.35)
      tl.to(e, { fov: to.fov, duration: 1.8, ease: 'power2.inOut' }, 0.6)
      tl.to(pose, { shift: 0, inside: 1, duration: 1.4, ease: 'power2.inOut' }, 0)
      transition.current = tl
      return
    }

    if (e.active) {
      // Saindo da vista do lugar: a câmera em primeira pessoa voa até onde a
      // pose da etapa seguinte põe a câmera, já olhando para o alvo dela, e só
      // então a pose em órbita assume (no mesmo ponto, sem salto).
      fromCamera()
      resetLook()
      cameraState.pov = false
      const target = poseFor(phase, sel, aspect)
      const h = target.dist * Math.cos(target.el)
      const px = target.tx + h * Math.sin(target.az)
      const py = target.ty + target.dist * Math.sin(target.el)
      const pz = target.tz + h * Math.cos(target.az)
      const dx = target.tx - px
      const dy = target.ty - py
      const dz = target.tz - pz
      const yaw = Math.atan2(dx, dz)
      const pitch = Math.atan2(dy, Math.hypot(dx, dz))
      const far = Math.hypot(px - e.x, py - e.y, pz - e.z) > 60
      const duration = far ? 3.2 : 1.9
      const tl = gsap.timeline({
        onComplete: () => {
          e.active = false
          Object.assign(pose, target)
          // o parallax do mouse volta aos poucos, a partir de zero
          m.parallax = 0
          m.parallaxX = 0
          m.parallaxY = 0
          transition.current = null
        },
      })
      tl.to(e, { yaw: e.yaw + angleDelta(e.yaw, yaw), pitch, duration, ease: 'power2.inOut' }, 0)
      tl.to(e, { x: px, y: py, z: pz, duration: duration - 0.2, ease: far ? 'power3.inOut' : 'power2.inOut' }, 0.2)
      tl.to(e, { fov: target.fov, near: MathUtils.clamp(target.dist * 0.05, 0.12, 4), duration: duration - 0.3, ease: 'power2.inOut' }, 0.3)
      tl.to(pose, { shift: target.shift, inside: target.inside, duration: duration - 0.3, ease: 'power2.inOut' }, 0.3)
      transition.current = tl
      return
    }

    const target = poseFor(phase, sel, aspect)
    target.az = pose.az + angleDelta(pose.az, target.az)
    transition.current = gsap.to(pose, {
      ...target,
      duration: transitionDuration(from.phase, phase),
      ease: 'power3.inOut',
      onComplete: () => {
        transition.current = null
      },
    })
  }, [phase, selectedBlock, selectedBox, selectedSeat, get])

  // Olhar em volta na vista da cadeira: arrastar (mouse ou dedo) gira o olhar,
  // dentro de limites, como quem vira a cabeça.
  useEffect(() => {
    if (phase !== 'pov') return
    const canvas = get().gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0
    const down = (event: PointerEvent) => {
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
      canvas.setPointerCapture?.(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!dragging) return
      const l = look.current
      const scale = 2.4 / Math.max(window.innerWidth, window.innerHeight)
      l.targetYaw = MathUtils.clamp(l.targetYaw + (event.clientX - lastX) * scale, -1.35, 1.35)
      l.targetPitch = MathUtils.clamp(l.targetPitch + (event.clientY - lastY) * scale, -0.5, 0.45)
      l.lastInput = performance.now()
      lastX = event.clientX
      lastY = event.clientY
    }
    const up = () => {
      dragging = false
    }
    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    canvas.style.touchAction = 'none'
    canvas.style.cursor = 'grab'
    return () => {
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      canvas.style.touchAction = ''
      canvas.style.cursor = ''
    }
  }, [phase, get])

  useFrame((state, delta) => {
    const pose = rig.current
    const m = motion.current
    const camera = state.camera as PerspectiveCamera
    const aerial = phase === 'aerial'
    const e = eye.current
    cameraState.moving = !!transition.current

    if (e.active) {
      // primeira pessoa: olho na cadeira, mais o olhar em volta
      const l = look.current
      const idle = (performance.now() - l.lastInput) / 1000
      // parado por uns segundos, o olhar passeia devagar pelo estádio
      l.sway = MathUtils.damp(l.sway, phase === 'pov' && idle > 3 && !transition.current ? 1 : 0, 0.8, delta)
      const t = state.clock.elapsedTime
      l.yaw = MathUtils.damp(l.yaw, l.targetYaw, 6, delta)
      l.pitch = MathUtils.damp(l.pitch, l.targetPitch, 6, delta)
      const yaw = e.yaw + l.yaw + Math.sin(t * 0.32) * 0.14 * l.sway
      const pitch = MathUtils.clamp(e.pitch + l.pitch + Math.sin(t * 0.47) * 0.035 * l.sway, -1.2, 1.2)
      camera.position.set(e.x, e.y, e.z)
      const { direction } = scratch.current
      direction.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
      camera.up.copy(UP)
      camera.lookAt(e.x + direction.x, e.y + direction.y, e.z + direction.z)
      if (Math.abs(camera.fov - e.fov) > 1e-3 || Math.abs(camera.near - e.near) > 1e-3) {
        camera.fov = e.fov
        camera.near = e.near
        camera.updateProjectionMatrix()
      }
    } else {
      if (navigable(phase) && !transition.current) {
        // parada numa etapa: acompanha redimensionamentos da janela
        const sel = { block: selectedBlock, box: selectedBox, seat: selectedSeat }
        const target = poseFor(phase, sel, state.size.width / state.size.height, settled.current)
        pose.dist = MathUtils.damp(pose.dist, target.dist, 3, delta)
        pose.tx = MathUtils.damp(pose.tx, target.tx, 3, delta)
        pose.ty = MathUtils.damp(pose.ty, target.ty, 3, delta)
        pose.tz = MathUtils.damp(pose.tz, target.tz, 3, delta)
        pose.shift = MathUtils.damp(pose.shift, target.shift, 3, delta)
        pose.inside = MathUtils.damp(pose.inside, target.inside, 3, delta)
        pose.az += angleDelta(pose.az, target.az) * (1 - Math.exp(-3 * delta))
      }
      if (aerial) m.idle += delta

      // parallax suave com o mouse (menor no setor e nenhum na escolha da
      // cadeira, para a cadeira não fugir do cursor) e uma leve deriva parada
      const parallax = aerial ? 1 : phase === 'sector' ? 0.45 : phase === 'box' ? 0.25 : phase === 'seat' ? 0.2 : 0
      m.parallax = MathUtils.damp(m.parallax, navigable(phase) ? parallax : 0, 2, delta)
      m.parallaxX = MathUtils.damp(m.parallaxX, state.pointer.x * m.parallax, 2.5, delta)
      m.parallaxY = MathUtils.damp(m.parallaxY, state.pointer.y * m.parallax, 2.5, delta)
      const drift = aerial ? Math.sin(m.idle * 0.12) * 0.025 : 0

      const az = pose.az + m.parallaxX * 0.045 + drift
      const el = Math.min(1.45, pose.el + m.parallaxY * 0.03)
      const horizontal = pose.dist * Math.cos(el)
      camera.position.set(
        pose.tx + horizontal * Math.sin(az),
        pose.ty + pose.dist * Math.sin(el),
        pose.tz + horizontal * Math.cos(az),
      )
      camera.lookAt(pose.tx, pose.ty, pose.tz)

      // de perto o plano de corte próximo também se aproxima; de longe ele fica
      // afastado para não perder precisão de profundidade na cidade
      const near = MathUtils.clamp(pose.dist * 0.05, 0.12, 4)
      if (Math.abs(camera.fov - pose.fov) > 1e-3 || Math.abs(camera.near - near) > 0.02) {
        camera.fov = pose.fov
        camera.near = near
        camera.updateProjectionMatrix()
      }
    }

    // Entrando no estádio, tudo o que fica fora dele se apaga na neblina
    // (ver outsideFog.ts) enquanto a câmera desce; coberto por inteiro, o
    // entorno deixa de ser desenhado e animado.
    const close = 1 - MathUtils.smoothstep(camera.position.length(), 220, 380)
    outsideFog.value = pose.inside * close
    outside.visible = outsideFog.value < 0.999

    // imagem deslocada para cima (painel embaixo, no celular)
    const v = view.current
    const { width, height } = state.size
    if (Math.abs(pose.shift - v.shift) > 1e-4 || v.width !== width || v.height !== height) {
      if (Math.abs(pose.shift) < 1e-4) camera.clearViewOffset()
      else camera.setViewOffset(width, height, 0, pose.shift * height, width, height)
      v.shift = pose.shift
      v.width = width
      v.height = height
    }
  })

  return null
}
