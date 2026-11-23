import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { MathUtils, PerspectiveCamera } from 'three'
import { introDisabled, useExperience } from '../store/experience'
import { aerialPose, INTRO_START, INTRO_SWEEP, type Pose } from './cameraPoses'

export function CameraRig() {
  const get = useThree((s) => s.get)
  const phase = useExperience((s) => s.phase)
  const introSkipped = useExperience((s) => s.introSkipped)
  const setPhase = useExperience((s) => s.setPhase)

  const rig = useRef<Pose>({ ...(introDisabled ? aerialPose(1.6) : INTRO_START) })
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const motion = useRef({ parallaxX: 0, parallaxY: 0, idle: 0 })
  const aerialTarget = useRef(aerialPose(1.6))

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

  useFrame((state, delta) => {
    const pose = rig.current
    const m = motion.current
    const camera = state.camera as PerspectiveCamera
    const aerial = phase === 'aerial'

    if (aerial) {
      // acompanha redimensionamentos da janela
      const target = aerialPose(state.size.width / state.size.height, aerialTarget.current)
      pose.dist = MathUtils.damp(pose.dist, target.dist, 3, delta)
      pose.tx = MathUtils.damp(pose.tx, target.tx, 3, delta)
      m.idle += delta
    }

    // parallax suave com o mouse e uma leve deriva quando parado
    m.parallaxX = MathUtils.damp(m.parallaxX, aerial ? state.pointer.x : 0, 2.5, delta)
    m.parallaxY = MathUtils.damp(m.parallaxY, aerial ? state.pointer.y : 0, 2.5, delta)
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
    if (Math.abs(camera.fov - pose.fov) > 1e-3) {
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
