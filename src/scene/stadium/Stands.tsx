import { useMemo } from 'react'
import { MeshLambertMaterial } from 'three'
import { getLayout } from '../../lib/layout'
import { once } from '../../lib/once'
import { buildStandsGeometry } from '../../lib/standsGeometry'
import { extendShader } from '../pixelScale'
import { HIGHLIGHT_LINEAR, SELECTION_FUNCTIONS, SELECTION_HEADER, selectionUniforms } from '../selection'
import { withSurfaceNoise } from './materials'
import { getSeatMap } from './seatMap'

/**
 * Bloco sob o cursor ou escolhido em laranja; na vista de frente, os outros
 * blocos escurecem. Entra antes da iluminação, depois de toda a cor.
 * (O painel de LED na frente do bloco acende em LedRibbons.)
 */
const BLOCK_HIGHLIGHT = /* glsl */ `
{
  float picked = selIs(vBlockId, uSelectBlock);
  float hl = max(selIs(vBlockId, uHoverBlock) * 0.85, picked);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${HIGHLIGHT_LINEAR} * 0.9, hl * 0.72);
  totalEmissiveRadiance += ${HIGHLIGHT_LINEAR} * hl * (0.2 + 0.16 * uPulse * picked);
  float dim = step(0.0, uFocusBlock) * (1.0 - selIs(vBlockId, uFocusBlock));
  diffuseColor.rgb *= 1.0 - dim * 0.55;
}
`

const getStandsParts = once(() => {
  const layout = getLayout()
  const material = withSurfaceNoise(new MeshLambertMaterial({ vertexColors: true }), 'stands', {
    fill: 1.15,
    seatMap: getSeatMap(),
  })
  extendShader(material, 'block-highlight', (shader) => {
    Object.assign(shader.uniforms, selectionUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBlock;\nvarying float vBlockId;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlockId = aBlock;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vBlockId;\n${SELECTION_HEADER}\n${SELECTION_FUNCTIONS}`)
      .replace('#include <lights_lambert_fragment>', `${BLOCK_HIGHLIGHT}\n#include <lights_lambert_fragment>`)
  })
  return { geometries: buildStandsGeometry(layout), material }
})

export function Stands() {
  const { geometries, material } = useMemo(() => getStandsParts(), [])
  return (
    <group>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={material} />
      ))}
    </group>
  )
}
