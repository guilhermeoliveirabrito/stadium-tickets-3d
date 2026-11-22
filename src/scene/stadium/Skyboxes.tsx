import { useMemo } from 'react'
import { BoxGeometry, BufferGeometry, Matrix4, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SKYBOX } from '../../config/stadium'
import { frameAt, SEGMENTS, type Frame } from '../../lib/bowl'
import { getSkyboxes, SKYBOX_SEGMENTS } from '../../lib/skyboxes'
import { profile, SweepBuilder } from '../../lib/sweep'
import { FrameInstances } from './FrameInstances'
import { withSurfaceNoise } from './materials'

const OTHER_SEGMENTS = [1, 2, 3, 5, 6, 7]

function createArmchairGeometry(): BufferGeometry {
  const parts = [
    new BoxGeometry(0.56, 0.24, 0.5).translate(0, 0.12, 0),
    new BoxGeometry(0.64, 0.2, 0.6).translate(0, 0.34, 0.04),
    new BoxGeometry(0.64, 0.62, 0.16).translate(0, 0.3, 0).rotateX(-0.14).translate(0, 0.44, -0.24),
    new BoxGeometry(0.1, 0.24, 0.58).translate(-0.32, 0.52, 0.02),
    new BoxGeometry(0.1, 0.24, 0.58).translate(0.32, 0.52, 0.02),
  ]
  const g = mergeGeometries(parts)!
  g.deleteAttribute('uv')
  return g
}

export function Skyboxes() {
  const parts = useMemo(() => {
    const { front, floor, ceiling, back } = SKYBOX
    const [, r1, r2] = SKYBOX.rows

    const shell = new SweepBuilder()
      .around(
        profile([
          [20.3, floor - 0.4, '#5d5f63'],
          [20.3, floor, '#3a3b40'],
          [r1[0] - 0.55, floor, '#2b2c30'],
          [r1[0] - 0.55, r1[1], '#3a3b40'],
          [r2[0] - 0.55, r1[1], '#2b2c30'],
          [r2[0] - 0.55, r2[1], '#3a3b40'],
          [back, r2[1], '#5d5f63'],
          [back, floor - 0.4, '#5d5f63'],
        ]),
        SKYBOX_SEGMENTS,
      )
      .around(
        profile([
          [back - 0.3, r2[1], '#7b5236'],
          [back - 0.3, ceiling, '#7b5236'],
          [back, ceiling, '#7b5236'],
          [back, r2[1], '#7b5236'],
        ]),
        SKYBOX_SEGMENTS,
      )
      .around(
        profile([
          [20.3, floor, '#2c2f35'],
          [20.3, ceiling, '#2c2f35'],
          [front, ceiling, '#2c2f35'],
          [front, floor, '#2c2f35'],
        ]),
        OTHER_SEGMENTS,
      )
      .build()

    const glass = new SweepBuilder()
      .around(
        profile([
          [front, floor, '#ffffff'],
          [front, ceiling, '#ffffff'],
        ]),
        SKYBOX_SEGMENTS,
        false,
      )
      .build()

    const boxes = getSkyboxes()
    const frameOf = (segment: number, s: number, d: number): Frame => frameAt(SEGMENTS[segment], s, d)
    const lineLength = (segment: number) => {
      const seg = SEGMENTS[segment]
      return seg.kind === 'line' ? seg.length : 1
    }

    const partitions: Frame[] = []
    const mullions: Frame[] = []
    const chairs: { frame: Frame; y: number }[] = []
    const lights: Frame[] = []
    for (const segment of SKYBOX_SEGMENTS) {
      const count = boxes.filter((b) => b.segment === segment).length
      for (let k = 0; k <= count; k++) partitions.push(frameOf(segment, k / count, (front + back) / 2))
      const mullionCount = Math.round(lineLength(segment) / 2)
      for (let k = 1; k < mullionCount; k++) mullions.push(frameOf(segment, k / mullionCount, front + 0.04))
    }
    for (const box of boxes) {
      const len = lineLength(box.segment)
      for (const [d, y] of SKYBOX.rows) {
        for (let j = 0; j < SKYBOX.chairsPerRow; j++) {
          const offset = (j - (SKYBOX.chairsPerRow - 1) / 2) * 0.8
          chairs.push({ frame: frameOf(box.segment, box.center + offset / len, d), y })
        }
      }
      lights.push(frameOf(box.segment, box.center, 22.4), frameOf(box.segment, box.center, 25.2))
    }

    return {
      shell,
      glass,
      partitions,
      mullions,
      chairs,
      lights,
      shellMaterial: withSurfaceNoise(new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 'skybox', 0.1),
      glassMaterial: new MeshStandardMaterial({
        color: '#a9c2d6',
        roughness: 0.04,
        metalness: 0.1,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        envMapIntensity: 1.6,
      }),
      wallMaterial: new MeshStandardMaterial({ color: '#e7e3dc', roughness: 0.7 }),
      frameMaterial: new MeshStandardMaterial({ color: '#2a2d33', roughness: 0.4, metalness: 0.5 }),
      leather: new MeshStandardMaterial({ color: '#1c1c20', roughness: 0.34, metalness: 0.05 }),
      lightMaterial: new MeshStandardMaterial({ color: '#fff', emissive: '#ffd9a6', emissiveIntensity: 2.2 }),
      partitionGeometry: new BoxGeometry(0.16, ceiling - floor, back - front).translate(0, (ceiling - floor) / 2, 0),
      mullionGeometry: new BoxGeometry(0.07, ceiling - floor, 0.1).translate(0, (ceiling - floor) / 2, 0),
      chairGeometry: createArmchairGeometry(),
      lightGeometry: new BoxGeometry(5.6, 0.05, 0.35),
      identity: new Matrix4(),
    }
  }, [])

  const chairFrames = useMemo(() => parts.chairs.map((c) => c.frame), [parts])
  const chairY = useMemo(() => (_: Frame, i: number) => parts.chairs[i].y, [parts])

  return (
    <group>
      <mesh geometry={parts.shell} material={parts.shellMaterial} castShadow receiveShadow />
      <mesh geometry={parts.glass} material={parts.glassMaterial} renderOrder={2} />
      <FrameInstances
        frames={parts.partitions}
        y={SKYBOX.floor}
        geometry={parts.partitionGeometry}
        material={parts.wallMaterial}
        castShadow
        receiveShadow
      />
      <FrameInstances
        frames={parts.mullions}
        y={SKYBOX.floor}
        geometry={parts.mullionGeometry}
        material={parts.frameMaterial}
      />
      <FrameInstances
        frames={chairFrames}
        y={chairY}
        geometry={parts.chairGeometry}
        material={parts.leather}
        castShadow
        receiveShadow
      />
      <FrameInstances
        frames={parts.lights}
        y={SKYBOX.ceiling - 0.04}
        geometry={parts.lightGeometry}
        material={parts.lightMaterial}
      />
    </group>
  )
}
