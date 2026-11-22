import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { SEAT_COLORS } from '../../config/stadium'
import { getLayout } from '../../lib/layout'
import { mulberry32 } from '../../lib/random'
import { extendShader, pixelUniforms } from '../pixelScale'
import { withLocalFill } from './materials'
import { createSeatGeometry } from './seatGeometry'

/**
 * De longe cada cadeira (0,44 m) fica menor que um pixel e as frestas entre
 * as fileiras viram listras escuras que andam quando a câmera se move. Quando
 * a cadeira fica menor que ~2,5 pixels, ela cresce aos poucos até ocupar a
 * célula inteira (largura do assento e o espaço das pernas à frente). De perto
 * nada muda.
 */
const SEAT_HEADER = /* glsl */ `
uniform float uPixelAngle;
attribute vec3 aSeatAverage;
float gSeatGrow;
`

/**
 * Além de crescer, de longe a cor da cadeira se mistura com a média das
 * vizinhas (como o mipmap de uma textura): o mapa de lugares livres continua
 * visível, sem o contraste pixel a pixel que tremula quando a câmera anda.
 */
const SEAT_COLOR = /* glsl */ `
#ifdef USE_INSTANCING
{
  vec4 seatView = modelViewMatrix * instanceMatrix * vec4(0.0, 0.6, 0.0, 1.0);
  float seatPixel = max(-seatView.z, 0.0) * uPixelAngle;
  gSeatGrow = clamp((2.5 * seatPixel - 0.44) / 0.44, 0.0, 1.0);
  float seatsPerPixel = seatPixel / 0.5;
  vColor.xyz = mix(vColor.xyz, aSeatAverage, 0.6 * smoothstep(0.45, 1.1, seatsPerPixel));
}
#endif
`

const SEAT_GROW = /* glsl */ `
#ifdef USE_INSTANCING
  transformed.x *= 1.0 + 0.13 * gSeatGrow;
  transformed.z += step(0.0, transformed.z) * 0.26 * gSeatGrow;
#endif
`

/** Média das cores num bloco de 7 cadeiras x 5 fileiras em volta de cada cadeira. */
function neighbourAverage(colors: Float32Array, block: Uint16Array, row: Uint8Array, number: Uint8Array) {
  const out = new Float32Array(colors.length)
  const grid = new Map<number, number>()
  const key = (b: number, r: number, n: number) => (b * 256 + r) * 256 + n
  for (let i = 0; i < block.length; i++) grid.set(key(block[i], row[i], number[i]), i)
  for (let i = 0; i < block.length; i++) {
    let r = 0
    let g = 0
    let b = 0
    let count = 0
    for (let dr = -2; dr <= 2; dr++) {
      for (let dn = -3; dn <= 3; dn++) {
        const j = grid.get(key(block[i], row[i] + dr, number[i] + dn))
        if (j === undefined) continue
        r += colors[j * 3]
        g += colors[j * 3 + 1]
        b += colors[j * 3 + 2]
        count++
      }
    }
    out.set([r / count, g / count, b / count], i * 3)
  }
  return out
}

export function Seats() {
  const { seats } = getLayout()
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => createSeatGeometry(), [])
  const material = useMemo(
    () =>
      extendShader(
        withLocalFill(new MeshStandardMaterial({ roughness: 0.38, metalness: 0, side: DoubleSide }), 'seats', 1.15),
        'seat-grow',
        (shader) => {
          Object.assign(shader.uniforms, pixelUniforms)
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\n${SEAT_HEADER}`)
            .replace('#include <color_vertex>', `#include <color_vertex>\n${SEAT_COLOR}`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SEAT_GROW}`)
        },
      ),
    [],
  )

  useLayoutEffect(() => {
    const mesh = ref.current!
    const dummy = new Object3D()
    const color = new Color()
    const taken = new Color(SEAT_COLORS.taken)
    const available = new Color(SEAT_COLORS.available)
    const rand = mulberry32(42)
    for (let i = 0; i < seats.count; i++) {
      dummy.position.fromArray(seats.position, i * 3)
      dummy.rotation.set(0, seats.yaw[i], 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // leve variação de tom, como plástico desbotado pelo sol
      color.copy(seats.taken[i] ? taken : available)
      color.multiplyScalar(0.92 + rand() * 0.14)
      mesh.setColorAt(i, color)
    }
    const average = neighbourAverage(mesh.instanceColor!.array as Float32Array, seats.block, seats.row, seats.number)
    geometry.setAttribute('aSeatAverage', new InstancedBufferAttribute(average, 3))
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [seats, geometry])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, seats.count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}
