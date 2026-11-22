import { Environment } from '@react-three/drei'
import { useMemo } from 'react'
import { BackSide } from 'three'
import { FOG, SUN_DIRECTION } from '../config/world'
import { GradientSky } from './GradientSky'

export function Atmosphere() {
  const lightPosition = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(600), [])

  return (
    <>
      <GradientSky />

      <Environment resolution={256} frames={1} environmentIntensity={0.42}>
        <GradientSky radius={400} animated={false} clouds={0.6} />
        {/* metade de baixo do mapa: grama e concreto refletindo luz */}
        <mesh position-y={-210} scale={[400, 200, 400]}>
          <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshBasicMaterial color="#56603f" side={BackSide} />
        </mesh>
      </Environment>

      <hemisphereLight args={['#dce8ff', '#4f5a36', 0.2]} />

      <directionalLight
        position={lightPosition}
        intensity={4.2}
        color="#fff1de"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
        shadow-radius={3}
      >
        <orthographicCamera attach="shadow-camera" args={[-170, 170, 170, -170, 100, 1200]} />
      </directionalLight>

      <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />
    </>
  )
}
