import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { NIGHT } from '../config/world'
import { Atmosphere } from './Atmosphere'
import { CameraRig } from './CameraRig'
import { DevCamera } from './DevCamera'
import { City } from './city/City'
import { PostFX } from './PostFX'
import { ReadySignal } from './ReadySignal'
import { Stadium } from './stadium/Stadium'

const devCamera = import.meta.env.DEV && new URLSearchParams(window.location.search).has('cam')

const maxDpr = Math.min(2, window.devicePixelRatio || 1)

export function Experience() {
  // começa em 1,5x e cai para 1x se a máquina não aguentar a cena
  const [dpr, setDpr] = useState(Math.min(1.5, maxDpr))

  return (
    <Canvas
      className="experience"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = NIGHT.exposure
      }}
      camera={{ fov: 35, near: 4, far: 9000, position: [0, 470, 120] }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} flipflops={3} />
      <Atmosphere />
      {devCamera ? <DevCamera /> : <CameraRig />}
      <Stadium />
      <City />
      <PostFX />
      <ReadySignal skipIntro={devCamera} />
    </Canvas>
  )
}
