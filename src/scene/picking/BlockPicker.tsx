import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial } from 'three'
import { arcSamples } from '../../lib/sweep'
import { frameAt, SEGMENTS } from '../../lib/bowl'
import { getLayout } from '../../lib/layout'
import { once } from '../../lib/once'
import { useExperience } from '../../store/experience'

/**
 * Superfície invisível e simples (uma rampa por bloco, da primeira à última
 * fileira) usada só para descobrir qual bloco está sob o cursor. Testar a
 * geometria real das arquibancadas (dezenas de milhares de triângulos) a cada
 * movimento do mouse seria pesado; aqui são poucas centenas.
 */
const getProxy = once(() => {
  const { blocks, tiers } = getLayout()
  const positions: number[] = []
  const triangleBlock: number[] = []
  const f0 = frameAt(SEGMENTS[0], 0, 0)
  const f1 = frameAt(SEGMENTS[0], 0, 0)
  for (const block of blocks) {
    const tier = tiers.find((t) => t.spec.id === block.tier)!
    const seg = SEGMENTS[block.segment]
    const first = tier.rows[0]
    const last = tier.rows[tier.rows.length - 1]
    const dFront = first.d
    const dBack = tier.back
    const yFront = first.y + 0.4
    const yBack = last.y + 1.1
    const samples = arcSamples(seg, block.s1 - block.s0)
    for (let k = 0; k < samples; k++) {
      const sa = block.s0 + ((block.s1 - block.s0) * k) / samples
      const sb = block.s0 + ((block.s1 - block.s0) * (k + 1)) / samples
      const quad: [number, number, number][] = []
      for (const [s, d, y] of [
        [sa, dFront, yFront],
        [sb, dFront, yFront],
        [sb, dBack, yBack],
        [sa, dBack, yBack],
      ] as const) {
        const f = frameAt(seg, s, d, d === dFront ? f0 : f1)
        quad.push([f.x, y, f.z])
      }
      for (const i of [0, 1, 2, 0, 2, 3]) positions.push(...quad[i])
      triangleBlock.push(block.index, block.index)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()
  const material = new MeshBasicMaterial({ side: 2 })
  // não é desenhada, mas continua testável pelo raio do cursor
  material.visible = false
  return { geometry, material, triangleBlock }
})

const canHover = window.matchMedia('(hover: hover)').matches

export function BlockPicker() {
  const { geometry, material, triangleBlock } = useMemo(() => getProxy(), [])
  const phase = useExperience((s) => s.phase)
  const active = phase === 'aerial' || phase === 'sector'

  const blockOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.faceIndex == null ? -1 : triangleBlock[e.faceIndex])

  if (!active) return null
  return (
    <mesh
      geometry={geometry}
      material={material}
      onPointerMove={(e) => {
        if (!canHover) return
        e.stopPropagation()
        useExperience.getState().setHoverBlock(blockOf(e))
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        useExperience.getState().setHoverBlock(-1)
        document.body.style.cursor = ''
      }}
      onClick={(e) => {
        e.stopPropagation()
        const block = blockOf(e)
        if (block < 0) return
        const state = useExperience.getState()
        // no setor, tocar de novo no bloco escolhido abre a vista de frente
        if (state.phase === 'sector' && state.selectedBlock === block) state.openBlock()
        else state.selectBlock(block)
      }}
    />
  )
}
