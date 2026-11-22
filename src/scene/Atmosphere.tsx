import { Environment } from '@react-three/drei'
import { useMemo } from 'react'
import { BackSide } from 'three'
import { FOG, MOONLIGHT_DIRECTION, NIGHT } from '../config/world'
import { NightSky } from './NightSky'

export function Atmosphere() {
  const lightPosition = useMemo(() => MOONLIGHT_DIRECTION.clone().multiplyScalar(600), [])

  return (
    <>
      <NightSky />

      <Environment resolution={256} frames={1} environmentIntensity={NIGHT.environmentIntensity}>
        <NightSky radius={400} animated={false} clouds={0.5} stars={0} />
        {/* metade de baixo: chão escuro com o brilho difuso da cidade */}
        <mesh position-y={-210} scale={[400, 200, 400]}>
          <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshBasicMaterial color="#1a1712" side={BackSide} />
        </mesh>
      </Environment>

      <hemisphereLight
        args={[NIGHT.hemisphere.sky, NIGHT.hemisphere.ground, NIGHT.hemisphere.intensity]}
      />

      <directionalLight position={lightPosition} intensity={NIGHT.moonlight.intensity} color={NIGHT.moonlight.color} />

      <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />
    </>
  )
}
