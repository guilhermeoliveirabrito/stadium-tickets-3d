import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { Fog, MathUtils, PerspectiveCamera } from 'three'
import { FOG } from '../config/world'
import { getBlockInfo } from '../lib/blocks'
import { getSkyboxes } from '../lib/skyboxes'
import { introDisabled, type Phase, useExperience } from '../store/experience'
import { aerialPose, blockPose, boxPose, INTRO_START, INTRO_SWEEP, type Pose, sectorPose } from './cameraPoses'
import { glowFog } from './glowMaterial'
import { outside } from './outside'

/** além desta distância da câmera nada do estádio fica para trás da neblina "de dentro" */
const STADIUM_REACH = 140

/** Diferença entre dois ângulos, no intervalo [-π, π]: a câmera sempre gira pelo lado mais curto. */
function angleDelta(from: number, to: number) {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
}

/** Pose de cada etapa da escolha para a proporção de tela atual. */
function poseFor(phase: Phase, block: number, box: number, aspect: number, out?: Pose) {
  if (phase === 'sector' && block >= 0) return sectorPose(getBlockInfo(block), aspect, out)
  if (phase === 'block' && block >= 0) return blockPose(getBlockInfo(block), aspect, out)
  if (phase === 'box' && box >= 0) return boxPose(getSkyboxes()[box], aspect, out)
  return aerialPose(aspect, out)
}

/** Duração (s) de cada passagem entre etapas. */
function transitionDuration(from: Phase, to: Phase) {
  // de um camarote para o vizinho
  if (from === 'box' && to === 'box') return 1.3
  if (to === 'box') return from === 'aerial' ? 2.8 : 2
  if (from === 'box') return to === 'aerial' ? 2.5 : 1.9
  if (to === 'block') return 2
  if (to === 'aerial') return 2.3
  if (from === 'block') return 1.7
  // de um bloco para outro dentro da vista de setor
  if (from === 'sector') return 1.5
  // da visão geral até o setor: a descida mais longa
  return 2.6
}

const navigable = (phase: Phase) => phase === 'aerial' || phase === 'sector' || phase === 'block' || phase === 'box'

export function CameraRig() {
  const get = useThree((s) => s.get)
  const phase = useExperience((s) => s.phase)
  const selectedBlock = useExperience((s) => s.selectedBlock)
  const selectedBox = useExperience((s) => s.selectedBox)
  const introSkipped = useExperience((s) => s.introSkipped)
  const setPhase = useExperience((s) => s.setPhase)

  const rig = useRef<Pose>({ ...(introDisabled ? aerialPose(1.6) : INTRO_START) })
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const transition = useRef<gsap.core.Tween | null>(null)
  const previous = useRef({ phase, block: selectedBlock, box: selectedBox })
  const motion = useRef({ parallaxX: 0, parallaxY: 0, idle: 0, parallax: 1 })
  const view = useRef({ shift: 0, width: 0, height: 0 })
  const settled = useRef(aerialPose(1.6))

  useEffect(() => {
    if (phase !== 'intro') return
    const { width, height } = get().size
    const tl = gsap.timeline({ onComplete: () => setPhase('aerial') })
    tl.to(rig.current, { ...INTRO_SWEEP, duration: 6, ease: 'power1.inOut' })
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

  // passagens entre visão geral, setor e bloco
  useEffect(() => {
    const from = previous.current
    previous.current = { phase, block: selectedBlock, box: selectedBox }
    if (!navigable(phase) || !navigable(from.phase)) return
    if (from.phase === phase && from.block === selectedBlock && from.box === selectedBox) return

    const { width, height } = get().size
    const pose = rig.current
    const target = poseFor(phase, selectedBlock, selectedBox, width / height)
    target.az = pose.az + angleDelta(pose.az, target.az)
    transition.current?.kill()
    transition.current = gsap.to(pose, {
      ...target,
      duration: transitionDuration(from.phase, phase),
      ease: 'power3.inOut',
      onComplete: () => {
        transition.current = null
      },
    })
  }, [phase, selectedBlock, selectedBox, get])

  useFrame((state, delta) => {
    const pose = rig.current
    const m = motion.current
    const camera = state.camera as PerspectiveCamera
    const aerial = phase === 'aerial'

    if (navigable(phase) && !transition.current) {
      // parada numa etapa: acompanha redimensionamentos da janela
      const target = poseFor(phase, selectedBlock, selectedBox, state.size.width / state.size.height, settled.current)
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
    m.parallax = MathUtils.damp(m.parallax, aerial ? 1 : phase === 'sector' ? 0.45 : phase === 'block' ? 0 : phase === 'box' ? 0.25 : 1, 2, delta)
    m.parallaxX = MathUtils.damp(m.parallaxX, navigable(phase) ? state.pointer.x * m.parallax : 0, 2.5, delta)
    m.parallaxY = MathUtils.damp(m.parallaxY, navigable(phase) ? state.pointer.y * m.parallax : 0, 2.5, delta)
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
    const near = MathUtils.clamp(pose.dist * 0.05, 1, 4)
    if (Math.abs(camera.fov - pose.fov) > 1e-3 || Math.abs(camera.near - near) > 0.02) {
      camera.fov = pose.fov
      camera.near = near
      camera.updateProjectionMatrix()
    }

    // Dentro do estádio a neblina se fecha logo depois da última arquibancada:
    // a cidade some aos poucos enquanto a câmera desce e, quando não aparece
    // mais, deixa de ser desenhada.
    const fog = state.scene.fog
    if (fog instanceof Fog) {
      const reach = camera.position.length() + STADIUM_REACH
      fog.near = MathUtils.lerp(FOG.near, reach, pose.inside)
      fog.far = MathUtils.lerp(FOG.far, reach + 280, pose.inside)
      glowFog.uGlowFogNear.value = fog.near
      glowFog.uGlowFogFar.value = MathUtils.lerp(FOG.far * 1.4, fog.far, pose.inside)
      glowFog.uGlowFogAmount.value = MathUtils.lerp(0.75, 1, pose.inside)
    }
    outside.visible = pose.inside < 0.995

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
