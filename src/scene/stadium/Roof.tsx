import { useMemo } from 'react'
import { BoxGeometry, Matrix4, MeshStandardMaterial } from 'three'
import { ROOF } from '../../config/stadium'
import { pointsAlong, profile, SweepBuilder } from '../../lib/sweep'
import { FrameInstances } from './FrameInstances'
import { withSurfaceNoise } from './materials'

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

    const tilt = new Matrix4().makeRotationX(-slope)
    return {
      shell,
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
