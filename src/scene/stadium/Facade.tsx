import { useMemo } from 'react'
import { BoxGeometry, MeshStandardMaterial } from 'three'
import { FACADE } from '../../config/stadium'
import { pointsAlong, profile, SweepBuilder } from '../../lib/sweep'
import { FrameInstances } from './FrameInstances'
import { withSurfaceNoise } from './materials'

export function Facade() {
  const parts = useMemo(() => {
    const { wall, top, fins } = FACADE
    const glass = new SweepBuilder()
      .around(
        profile([
          [wall, 0, '#28303b'],
          [wall, top, '#28303b'],
          [wall + 0.3, top, '#28303b'],
          [wall + 0.3, 0, '#28303b'],
        ]),
      )
      .build()
    const podium = new SweepBuilder()
      .around(
        profile([
          [wall - 0.5, 0, '#cfc8bb'],
          [wall - 0.5, 1.1, '#ddd7cb'],
          [fins + 3.2, 1.1, '#cfc8bb'],
          [fins + 3.2, 0, '#cfc8bb'],
        ]),
      )
      .build()
    const finHeight = top + 0.2
    return {
      glass,
      podium,
      glassMaterial: new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.12,
        metalness: 0.6,
        envMapIntensity: 1.2,
      }),
      stone: withSurfaceNoise(new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 'podium', 0.15),
      finMaterial: new MeshStandardMaterial({ color: '#efede8', roughness: 0.5, metalness: 0.05 }),
      fins: pointsAlong(fins, 3.3),
      finGeometry: new BoxGeometry(0.55, finHeight, 2.4).translate(0, finHeight / 2, 0),
    }
  }, [])

  return (
    <group>
      <mesh geometry={parts.glass} material={parts.glassMaterial} receiveShadow />
      <mesh geometry={parts.podium} material={parts.stone} receiveShadow />
      <FrameInstances
        frames={parts.fins}
        y={0}
        geometry={parts.finGeometry}
        material={parts.finMaterial}
        castShadow
        receiveShadow
      />
    </group>
  )
}
