import { Canvas } from '@react-three/fiber'
import { Atmosphere } from './Atmosphere'
import { CameraRig } from './CameraRig'
import { DevCamera } from './DevCamera'
import { Park } from './park/Park'
import { PostFX } from './PostFX'
import { ReadySignal } from './ReadySignal'
import { StaticShadows } from './StaticShadows'
import { Stadium } from './stadium/Stadium'

const devCamera = import.meta.env.DEV && new URLSearchParams(window.location.search).has('cam')

export function Experience() {
  return (
    <Canvas
      className="experience"
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.8
      }}
      camera={{ fov: 35, near: 4, far: 9000, position: [0, 470, 120] }}
    >
      <Atmosphere />
      {devCamera ? <DevCamera /> : <CameraRig />}
      <Stadium />
      <Park />
      <StaticShadows />
      <PostFX />
      <ReadySignal skipIntro={devCamera} />
    </Canvas>
  )
}
