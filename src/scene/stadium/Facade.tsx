import { useMemo } from 'react'
import { BoxGeometry, MeshLambertMaterial, MeshStandardMaterial } from 'three'
import { FACADE } from '../../config/stadium'
import { pointsAlong, profile, SweepBuilder } from '../../lib/sweep'
import { FrameInstances } from './FrameInstances'
import { withSurfaceNoise } from './materials'
import { createNeonMaterial } from './neon'

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
    const stripHeight = top - 3.4
    // linha de LED no alto da base de pedra
    const podiumLine = new SweepBuilder()
      .around(
        profile([
          [fins + 3.25, 1.0, '#ffffff'],
          [fins + 3.25, 1.18, '#ffffff'],
        ]),
        undefined,
        false,
      )
      .build()
    return {
      podiumLine,
      glass,
      podium,
      // vidro escuro com a luz quente do saguão por trás
      glassMaterial: new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.12,
        metalness: 0.6,
        envMapIntensity: 1.2,
        emissive: '#ffb27a',
        emissiveIntensity: 0.16,
      }),
      neon: createNeonMaterial('facade', 3.4),
      podiumNeon: createNeonMaterial('podium', 2.6, 0),
      // faixa de LED na aresta externa de cada brise
      // faixa larga o bastante para não sumir e reaparecer entre os pixels de longe
      stripGeometry: new BoxGeometry(0.46, stripHeight, 0.08).translate(0, 2.2 + stripHeight / 2, -1.24),
      stone: withSurfaceNoise(new MeshLambertMaterial({ vertexColors: true }), 'podium', 0.15),
      finMaterial: new MeshLambertMaterial({ color: '#efede8' }),
      fins: pointsAlong(fins, 3.3),
      finGeometry: new BoxGeometry(0.55, finHeight, 2.4).translate(0, finHeight / 2, 0),
    }
  }, [])

  return (
    <group>
      <mesh geometry={parts.glass} material={parts.glassMaterial} receiveShadow />
      <mesh geometry={parts.podium} material={parts.stone} receiveShadow />
      <mesh geometry={parts.podiumLine} material={parts.podiumNeon} />
      <FrameInstances frames={parts.fins} y={0} geometry={parts.stripGeometry} material={parts.neon} />
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
