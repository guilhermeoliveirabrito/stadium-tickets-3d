import { Html } from '@react-three/drei'
import { SKYBOX } from '../../config/stadium'
import { formatPrice, getBlockInfo, seatLabel, seatPosition } from '../../lib/blocks'
import { getSkyboxes } from '../../lib/skyboxes'
import { ownedOrder, useExperience } from '../../store/experience'

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
  const orders = useExperience((s) => s.orders)
  if (phase !== 'block' || hoverSeat < 0) return null
  const owned = !!ownedOrder(orders, 'seat', hoverSeat)
  const seat = seatLabel(hoverSeat)
  const [x, y, z] = seatPosition(hoverSeat)
  const price = getBlockInfo(selectedBlock).price

  return (
    <Html position={[x, y + 0.9, z]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div className="seat-tip" data-taken={seat.taken} data-owned={owned} key={hoverSeat}>
        <span className="seat-tip__where">
          Fileira {seat.row} · Cadeira {seat.number}
        </span>
        <span className="seat-tip__status">
          {owned
            ? 'Seu ingresso'
            : seat.taken
              ? 'Ocupada'
              : hoverSeat === selectedSeat
                ? `Sua escolha · ${formatPrice(price)}`
                : formatPrice(price)}
        </span>
      </div>
    </Html>
  )
}

/** Rótulo do camarote sob o cursor: número e preço (ou "Vendido"). */
export function BoxLabel() {
  const phase = useExperience((s) => s.phase)
  const hoverBox = useExperience((s) => s.hoverBox)
  const selectedBox = useExperience((s) => s.selectedBox)
  const orders = useExperience((s) => s.orders)
  if (phase !== 'aerial' && phase !== 'sector' && phase !== 'box') return null
  if (hoverBox < 0 || (phase === 'box' && hoverBox === selectedBox)) return null
  const box = getSkyboxes()[hoverBox]
  const [x, , z] = box.position
  const [nx, nz] = box.normal
  // na frente do vidro, logo acima dele
  const d = (SKYBOX.back - SKYBOX.front) / 2
  const position: [number, number, number] = [x - nx * d, SKYBOX.ceiling + 0.2, z - nz * d]

  return (
    <Html position={position} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div className="block-label" key={hoverBox}>
        <span className="block-label__number">Camarote {box.number}</span>
        <span className="block-label__dot" />
        <span className="block-label__price" data-sold={box.sold}>
          {ownedOrder(orders, 'box', box.index) ? 'Seu camarote' : box.sold ? 'Vendido' : formatPrice(box.price)}
        </span>
        <span className="block-label__stem" />
      </div>
    </Html>
  )
}
