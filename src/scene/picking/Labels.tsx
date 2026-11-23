import { Html } from '@react-three/drei'
import { formatPrice, getBlockInfo } from '../../lib/blocks'
import { useExperience } from '../../store/experience'

/** Rótulo flutuando sobre o bloco: número, preço e lugares livres. */
export function BlockLabel() {
  const phase = useExperience((s) => s.phase)
  const hoverBlock = useExperience((s) => s.hoverBlock)
  const selectedBlock = useExperience((s) => s.selectedBlock)
  if (phase !== 'aerial' && phase !== 'sector') return null
  const block = hoverBlock >= 0 ? hoverBlock : phase === 'sector' ? selectedBlock : -1
  if (block < 0) return null
  const info = getBlockInfo(block)

  return (
    <Html position={info.labelAt} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div className="block-label" key={block}>
        <span className="block-label__number">Bloco {info.block.number}</span>
        <span className="block-label__dot" />
        <span className="block-label__price">{formatPrice(info.price)}</span>
        <span className="block-label__stem" />
      </div>
    </Html>
  )
}
