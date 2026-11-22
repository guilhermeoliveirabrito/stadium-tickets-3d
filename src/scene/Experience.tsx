import { Canvas } from '@react-three/fiber'
import { Atmosphere } from './Atmosphere'
import { DevCamera } from './DevCamera'
import { Stadium } from './stadium/Stadium'

export function Experience() {
  return (
    <Canvas
      className="experience"
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 35, near: 2, far: 9000, position: [-150, 120, 210] }}
    >
      <Atmosphere />
      {import.meta.env.DEV && <DevCamera />}
      <Stadium />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#5f7d3b" roughness={0.95} />
      </mesh>
    </Canvas>
  )
}
