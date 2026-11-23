import { useMemo } from 'react'
import { BoxGeometry, Color, Matrix4, MeshBasicMaterial, MeshLambertMaterial } from 'three'
import { ROOF } from '../../config/stadium'
import { pointsAlong, profile, SweepBuilder } from '../../lib/sweep'
import { FrameInstances } from './FrameInstances'
import { withSurfaceNoise } from './materials'
import { GlowSprites } from '../GlowSprites'
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
          [inner + 1.6, topAt(inner + 1.6), '#ffffff'],
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
      // anel mais largo (e um pouco menos intenso) para não serrilhar de longe
      innerRingMaterial: new MeshBasicMaterial({ color: new Color('#dfe8ff').multiplyScalar(1.9) }),
      shellMaterial: withSurfaceNoise(
        new MeshLambertMaterial({ vertexColors: true }),
        'roof',
        0.08,
      ),
      steel: new MeshLambertMaterial({ color: '#eeede9' }),
      lamp: new MeshLambertMaterial({
        color: '#d9dde3',
        emissive: '#f4f7ff',
        emissiveIntensity: 0.7,
      }),
      // brilho de cada refletor, logo abaixo da borda interna da cobertura
      lampGlows: pointsAlong(inner + 0.6, 3.1).map((f) => [f.x, innerY - t - 0.8, f.z] as [number, number, number]),
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
      <GlowSprites points={parts.lampGlows} color="#f2f5ff" size={2.4} intensity={6} />
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
