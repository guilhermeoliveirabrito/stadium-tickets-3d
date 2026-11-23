import { Html } from '@react-three/drei'
import { formatPrice, getBlockInfo, seatLabel, seatPosition } from '../../lib/blocks'
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

/** Informação da cadeira sob o cursor, na vista de frente do bloco. */
export function SeatTooltip() {
  const phase = useExperience((s) => s.phase)
  const hoverSeat = useExperience((s) => s.hoverSeat)
  const selectedSeat = useExperience((s) => s.selectedSeat)
  const selectedBlock = useExperience((s) => s.selectedBlock)
  if (phase !== 'block' || hoverSeat < 0) return null
  const seat = seatLabel(hoverSeat)
  const [x, y, z] = seatPosition(hoverSeat)
  const price = getBlockInfo(selectedBlock).price

  return (
    <Html position={[x, y + 0.9, z]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div className="seat-tip" data-taken={seat.taken} key={hoverSeat}>
        <span className="seat-tip__where">
          Fileira {seat.row} · Cadeira {seat.number}
        </span>
        <span className="seat-tip__status">
          {seat.taken ? 'Ocupada' : hoverSeat === selectedSeat ? `Sua escolha · ${formatPrice(price)}` : formatPrice(price)}
        </span>
      </div>
    </Html>
  )
}
