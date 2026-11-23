import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three'
import type { TierId } from '../config/stadium'
import { frameAt, SEGMENTS, segmentLength } from './bowl'
import type { StadiumLayout } from './layout'
import { arcSamples } from './sweep'

export interface Ribbon {
  geometry: BufferGeometry
  /** comprimento (m) de uma repetição do conteúdo, que divide a volta inteira */
  repeat: number
  height: number
}

/**
 * Painel de LED na frente de um anel: uma faixa em volta do estádio inteiro,
 * logo à frente do guarda-corpo, dividida por bloco (para o destaque do bloco
 * acender a parte da faixa na frente dele). O u da textura é o comprimento
 * percorrido em volta do estádio, em metros.
 */
export function buildRibbon(layout: StadiumLayout, tierId: TierId, aspect: number): Ribbon {
  const { spec } = layout.tiers.find((t) => t.spec.id === tierId)!
  const d = spec.front - 0.04
  const y0 = spec.under + 0.14
  const y1 = spec.firstRow + spec.parapet - 0.1
  const height = y1 - y0

  const starts: number[] = []
  let perimeter = 0
  for (const seg of SEGMENTS) {
    starts.push(perimeter)
    perimeter += segmentLength(seg, d)
  }

  const positions: number[] = []
  const uvs: number[] = []
  const blockIds: number[] = []
  const indices: number[] = []
  const f = frameAt(SEGMENTS[0], 0, 0)
  for (const block of layout.blocks) {
    if (block.tier !== tierId) continue
    const seg = SEGMENTS[block.segment]
    const length = segmentLength(seg, d)
    const samples = arcSamples(seg, block.s1 - block.s0)
    const base = positions.length / 3
    for (let k = 0; k <= samples; k++) {
      const s = block.s0 + ((block.s1 - block.s0) * k) / samples
      frameAt(seg, s, d, f)
      const u = starts[block.segment] + s * length
      positions.push(f.x, y0, f.z, f.x, y1, f.z)
      uvs.push(u, 0, u, 1)
      blockIds.push(block.index, block.index)
    }
    for (let k = 0; k < samples; k++) {
      const i = base + k * 2
      indices.push(i, i + 1, i + 3, i, i + 3, i + 2)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aRibbonUv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('aBlock', new Float32BufferAttribute(blockIds, 1))
  geometry.setIndex(new Uint32BufferAttribute(indices, 1))
  geometry.computeBoundingSphere()
  // o conteúdo mantém a proporção do desenho e fecha a volta sem emenda
  const wanted = height * aspect
  const repeat = perimeter / Math.max(1, Math.round(perimeter / wanted))
  return { geometry, repeat, height }
}
