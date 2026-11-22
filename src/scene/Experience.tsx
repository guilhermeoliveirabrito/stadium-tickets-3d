import { Canvas } from '@react-three/fiber'
import { Atmosphere } from './Atmosphere'
import { DevCamera } from './DevCamera'
import { Park } from './park/Park'
import { Stadium } from './stadium/Stadium'

export function Experience() {
  return (
    <Canvas
      className="experience"
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 35, near: 4, far: 9000, position: [0, 470, 120] }}
    >
      <Atmosphere />
      {import.meta.env.DEV && <DevCamera />}
      <Stadium />
      <Park />
    </Canvas>
  )
}
