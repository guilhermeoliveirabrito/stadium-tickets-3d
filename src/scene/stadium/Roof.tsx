import { useMemo } from 'react'
import { BoxGeometry, Color, Matrix4, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { ROOF } from '../../config/stadium'
import { pointsAlong, profile, SweepBuilder } from '../../lib/sweep'
import { FrameInstances } from './FrameInstances'
import { withSurfaceNoise } from './materials'
import { createNeonMaterial } from './neon'

const span = ROOF.outer - ROOF.inner
const slope = Math.atan2(ROOF.innerY - ROOF.outerY, span)
const midY = (ROOF.innerY + ROOF.outerY) / 2

export function Roof() {
  const parts = useMemo(() => {
    const { inner, outer, innerY, outerY, thickness: t } = ROOF
    const shell = new SweepBuilder()
      .around(
        profile([
          [inner, innerY - t, '#dedcd7'],
          [inner, innerY, '#f4f3ef'],
          [outer, outerY, '#e7e5e0'],
          [outer, outerY - t, '#d4d1cb'],
        ]),
      )
      .build()

    const topAt = (d: number) => innerY + ((outerY - innerY) * (d - inner)) / (outer - inner) + 0.06
    // anel de neon na borda externa (face lateral e uma faixa por cima)
    const rim = new SweepBuilder()
      .around(
        profile([
          [outer - 1.2, topAt(outer - 1.2), '#ffffff'],
          [outer + 0.02, topAt(outer) , '#ffffff'],
          [outer + 0.02, outerY - t, '#ffffff'],
        ]),
        undefined,
        false,
      )
      .build()
    // anel branco junto à borda interna, por cima da cobertura
    const innerRing = new SweepBuilder()
      .around(
        profile([
          [inner + 0.15, topAt(inner + 0.15), '#ffffff'],
          [inner + 0.9, topAt(inner + 0.9), '#ffffff'],
        ]),
        undefined,
        false,
      )
      .build()

    const tilt = new Matrix4().makeRotationX(-slope)
    return {
      shell,
      rim,
      innerRing,
      rimMaterial: createNeonMaterial('roof-rim', 3.6),
      innerRingMaterial: new MeshBasicMaterial({ color: new Color('#dfe8ff').multiplyScalar(2.4) }),
      shellMaterial: withSurfaceNoise(
        new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }),
        'roof',
        0.08,
      ),
      steel: new MeshStandardMaterial({ color: '#eeede9', roughness: 0.4, metalness: 0.25 }),
      lamp: new MeshStandardMaterial({
        color: '#d9dde3',
        emissive: '#f4f7ff',
        emissiveIntensity: 7,
        roughness: 0.3,
      }),
      ribs: pointsAlong((inner + outer) / 2, 6.2),
      lamps: pointsAlong(inner + 0.8, 3.1),
      ribGeometry: new BoxGeometry(0.45, 1.5, span),
      ridgeGeometry: new BoxGeometry(0.3, 0.22, span),
      lampGeometry: new BoxGeometry(1.1, 0.55, 0.7),
      ribLocal: tilt.clone().multiply(new Matrix4().makeTranslation(0, -t - 0.7, 0)),
      ridgeLocal: tilt.clone().multiply(new Matrix4().makeTranslation(0, 0.1, 0)),
      lampLocal: new Matrix4().makeRotationX(0.5),
    }
  }, [])

  return (
    <group>
      <mesh geometry={parts.shell} material={parts.shellMaterial} castShadow receiveShadow />
      <mesh geometry={parts.rim} material={parts.rimMaterial} />
      <mesh geometry={parts.innerRing} material={parts.innerRingMaterial} />
      <FrameInstances
        frames={parts.ribs}
        y={midY}
        local={parts.ribLocal}
        geometry={parts.ribGeometry}
        material={parts.steel}
        castShadow
        receiveShadow
      />
      <FrameInstances
        frames={parts.ribs}
        y={midY}
        local={parts.ridgeLocal}
        geometry={parts.ridgeGeometry}
        material={parts.steel}
        receiveShadow
      />
      <FrameInstances
        frames={parts.lamps}
        y={ROOF.innerY - ROOF.thickness - 0.45}
        local={parts.lampLocal}
        geometry={parts.lampGeometry}
        material={parts.lamp}
      />
    </group>
  )
}
