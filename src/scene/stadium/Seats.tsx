import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { getLayout } from '../../lib/layout'
import { getSeatColors } from '../../lib/seatColors'
import { extendShader, pixelUniforms } from '../pixelScale'
import { withLocalFill } from './materials'
import { createSeatGeometry } from './seatGeometry'

/**
 * As cadeiras 3D só aparecem de perto. Entre 3 e 2 pixels por cadeira elas
 * encolhem até sumir, enquanto o degrau embaixo passa a mostrar a cor delas
 * (ver o mapa de cadeiras em materials.ts). Abaixo disso nem são desenhadas.
 */
const SEAT_SHRINK = /* glsl */ `
#ifdef USE_INSTANCING
{
  vec4 seatView = modelViewMatrix * instanceMatrix * vec4(0.0, 0.6, 0.0, 1.0);
  float seatPx = 0.44 / max(-seatView.z * uPixelAngle, 1e-6);
  transformed *= smoothstep(2.0, 3.0, seatPx);
}
#endif
`

/** maior distância do centro do estádio até uma cadeira */
const FARTHEST_SEAT = 120

export function Seats() {
  const { seats } = getLayout()
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => createSeatGeometry(), [])
  const material = useMemo(
    () =>
      extendShader(
        withLocalFill(new MeshStandardMaterial({ roughness: 0.38, metalness: 0, side: DoubleSide }), 'seats', 1.15),
        'seat-shrink',
        (shader) => {
          Object.assign(shader.uniforms, pixelUniforms)
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uPixelAngle;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SEAT_SHRINK}`)
        },
      ),
    [],
  )

  useLayoutEffect(() => {
    const mesh = ref.current!
    const dummy = new Object3D()
    const colors = getSeatColors(seats)
    for (let i = 0; i < seats.count; i++) {
      dummy.position.fromArray(seats.position, i * 3)
      dummy.rotation.set(0, seats.yaw[i], 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3)
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [seats])

  // nem manda as 60 mil cadeiras para a placa de vídeo quando todas estão pequenas demais
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const nearest = Math.max(1, state.camera.position.length() - FARTHEST_SEAT)
    mesh.visible = 0.44 / (nearest * pixelUniforms.uPixelAngle.value) > 1.9
  })

  return <instancedMesh ref={ref} args={[geometry, material, seats.count]} frustumCulled={false} />
}
