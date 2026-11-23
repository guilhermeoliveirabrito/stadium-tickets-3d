import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, InstancedBufferAttribute, InstancedMesh, MeshLambertMaterial, Object3D } from 'three'
import { getLayout } from '../../lib/layout'
import { getSeatColors } from '../../lib/seatColors'
import { extendShader, pixelUniforms } from '../pixelScale'
import { HIGHLIGHT_LINEAR, SELECTION_FUNCTIONS, SELECTION_HEADER, selectionUniforms } from '../selection'
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

/**
 * Estados de cada cadeira: bloco em destaque (laranja), cadeira sob o cursor
 * (laranja forte, um pouco maior) e cadeira escolhida (branca, pulsando). Na
 * vista de frente, as cadeiras fora do bloco em foco ficam mais escuras.
 */
const SEAT_STATE_VERTEX = /* glsl */ `
vBlockHl = max(selIs(aSeatBlock, uHoverBlock) * 0.85, selIs(aSeatBlock, uSelectBlock));
vSeatHover = selIs(aSeatIndex, uHoverSeat);
vSeatPicked = selIs(aSeatIndex, uSelectSeat);
vSeatDim = step(0.0, uFocusBlock) * (1.0 - selIs(aSeatBlock, uFocusBlock));
transformed *= 1.0 + 0.16 * max(vSeatHover, vSeatPicked);
`

const SEAT_STATE_FRAGMENT = /* glsl */ `
diffuseColor.rgb = mix(diffuseColor.rgb, ${HIGHLIGHT_LINEAR} * 0.9, vBlockHl * 0.72);
diffuseColor.rgb *= 1.0 - vSeatDim * 0.55;
diffuseColor.rgb = mix(diffuseColor.rgb, ${HIGHLIGHT_LINEAR}, vSeatHover);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), vSeatPicked);
totalEmissiveRadiance += ${HIGHLIGHT_LINEAR} * (vBlockHl * 0.2 + vSeatHover * 0.7);
totalEmissiveRadiance += vec3(0.75) * vSeatPicked * (0.3 + 0.3 * uPulse);
`

const SEAT_VARYINGS = 'varying float vBlockHl;\nvarying float vSeatHover;\nvarying float vSeatPicked;\nvarying float vSeatDim;'

/** maior distância do centro do estádio até uma cadeira */
const FARTHEST_SEAT = 120

export function Seats() {
  const { seats } = getLayout()
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => createSeatGeometry(), [])
  const material = useMemo(
    () =>
      extendShader(
        withLocalFill(new MeshLambertMaterial({ side: DoubleSide }), 'seats', 1.15),
        'seat-shrink',
        (shader) => {
          Object.assign(shader.uniforms, pixelUniforms, selectionUniforms)
          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              `#include <common>
              uniform float uPixelAngle;
              attribute float aSeatIndex;
              attribute float aSeatBlock;
              ${SEAT_VARYINGS}
              ${SELECTION_HEADER}
              ${SELECTION_FUNCTIONS}`,
            )
            .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SEAT_STATE_VERTEX}\n${SEAT_SHRINK}`)
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${SEAT_VARYINGS}\n${SELECTION_HEADER}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SEAT_STATE_FRAGMENT}`)
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
    const index = new Float32Array(seats.count)
    for (let i = 0; i < seats.count; i++) index[i] = i
    geometry.setAttribute('aSeatIndex', new InstancedBufferAttribute(index, 1))
    geometry.setAttribute('aSeatBlock', new InstancedBufferAttribute(Float32Array.from(seats.block), 1))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [seats, geometry])

  // nem manda as 60 mil cadeiras para a placa de vídeo quando todas estão pequenas demais
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const nearest = Math.max(1, state.camera.position.length() - FARTHEST_SEAT)
    mesh.visible = 0.44 / (nearest * pixelUniforms.uPixelAngle.value) > 1.9
  })

  return <instancedMesh ref={ref} args={[geometry, material, seats.count]} frustumCulled={false} />
}
