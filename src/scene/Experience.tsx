import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useState } from 'react'
import { MAX_TIER, pixelRatioFor, START_TIER, type Tier, TIER_LOCKED, TIER_ORDER } from '../config/quality'
import { NIGHT } from '../config/world'
import { Atmosphere } from './Atmosphere'
import { CameraRig } from './CameraRig'
import { DevCamera } from './DevCamera'
import { City } from './city/City'
import { PostFX } from './PostFX'
import { PixelScale } from './pixelScale'
import { Precompile } from './Precompile'
import { ReadySignal } from './ReadySignal'
import { Stadium } from './stadium/Stadium'

const devCamera = import.meta.env.DEV && new URLSearchParams(window.location.search).has('cam')

function step(tier: Tier, delta: number): Tier {
  const index = TIER_ORDER.indexOf(tier) + delta
  const max = TIER_ORDER.indexOf(MAX_TIER)
  return TIER_ORDER[Math.max(0, Math.min(max, index))]
}

/** Resolução do canvas a partir do nível de qualidade e do tamanho da janela. */
function usePixelRatio(tier: Tier) {
  const [dpr, setDpr] = useState(() => pixelRatioFor(tier, window.innerWidth, window.innerHeight))
  useEffect(() => {
    const update = () => setDpr(pixelRatioFor(tier, window.innerWidth, window.innerHeight))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [tier])
  return dpr
}

export function Experience() {
  // começa num nível conforme o aparelho e se ajusta ao FPS medido
  const [tier, setTier] = useState<Tier>(START_TIER)
  const dpr = usePixelRatio(tier)
  // só começa a desenhar depois que os shaders estiverem compilados
  const [compiled, setCompiled] = useState(false)
  const onCompiled = useCallback(() => setCompiled(true), [])

  useEffect(() => {
    document.documentElement.dataset.quality = tier
  }, [tier])

  return (
    <Canvas
      className="experience"
      frameloop={compiled ? 'always' : 'never'}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = NIGHT.exposure
      }}
      camera={{ fov: 35, near: 4, far: 9000, position: [0, 470, 120] }}
    >
      {!TIER_LOCKED && (
        <PerformanceMonitor
          // fluidez primeiro: desce de nível já abaixo de 50 qps (numa tela de 60 Hz)
          bounds={(refresh) => (refresh > 100 ? [60, 100] : [50, 60])}
          onDecline={() => setTier((t) => step(t, -1))}
          onIncline={() => setTier((t) => step(t, 1))}
          flipflops={4}
        />
      )}
      <PixelScale />
      <Atmosphere />
      {devCamera ? <DevCamera /> : <CameraRig />}
      <Stadium />
      <City />
      <PostFX tier={tier} />
      <ReadySignal skipIntro={devCamera} />
      {!compiled && <Precompile onDone={onCompiled} />}
    </Canvas>
  )
}
