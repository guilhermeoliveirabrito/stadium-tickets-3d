import { useState } from 'react'
import { formatPrice, getBlockInfo, seatLabel } from '../lib/blocks'
import { ownedOrder, useExperience } from '../store/experience'
import { Chevron, EyeIcon } from './icons'

const canHover = window.matchMedia('(hover: hover)').matches

/** Painel da escolha da cadeira, com a legenda e o resumo da cadeira escolhida. */
export function BlockPanel({ visible }: { visible: boolean }) {
  const selectedBlock = useExperience((s) => s.selectedBlock)
  const selectedSeat = useExperience((s) => s.selectedSeat)
  const back = useExperience((s) => s.back)
  const openSeat = useExperience((s) => s.openSeat)
  const openPov = useExperience((s) => s.openPov)
  const openWallet = useExperience((s) => s.openWallet)
  const orders = useExperience((s) => s.orders)
  const [shown, setShown] = useState(selectedBlock)
  if (selectedBlock >= 0 && selectedBlock !== shown) setShown(selectedBlock)
  if (shown < 0) return null

  const info = getBlockInfo(shown)
  const seat = selectedSeat >= 0 ? seatLabel(selectedSeat) : null
  const owned = selectedSeat >= 0 ? ownedOrder(orders, 'seat', selectedSeat) : null
  const ownsAny = orders.some((o) => o.kind === 'seat')
  const tab = visible ? 0 : -1

  return (
    <section className="panel panel--block glass" data-visible={visible} aria-label="Escolha da cadeira" aria-hidden={!visible}>
      <p className="panel__kicker">
        Bloco {info.block.number} · {info.tierName}
      </p>
      <h2 className="panel__title">Escolha sua cadeira</h2>
      <p className="panel__text">
        {canHover ? 'Passe o mouse sobre as cadeiras e clique em uma livre.' : 'Toque em uma cadeira livre.'}
      </p>
      <ul className="legend">
        <li>
          <span className="legend__dot" style={{ background: 'var(--seat-blue)' }} />
          Livre
        </li>
        <li>
          <span className="legend__dot" style={{ background: 'var(--seat-red)' }} />
          Ocupada
        </li>
        <li>
          <span className="legend__dot legend__dot--picked" />
          Sua escolha
        </li>
        {ownsAny && (
          <li>
            <span className="legend__dot legend__dot--owned" />
            Seus ingressos
          </li>
        )}
      </ul>

      <div className="picked" data-empty={!seat}>
        {seat ? (
          <>
            <div>
              <p className="picked__label">{owned ? 'Já é sua' : 'Sua cadeira'}</p>
              <p className="picked__seat">
                Fileira {seat.row} · Cadeira {seat.number}
              </p>
            </div>
            <p className="picked__price">{owned ? owned.id : formatPrice(info.price)}</p>
          </>
        ) : (
          <p className="picked__label">Nenhuma cadeira escolhida</p>
        )}
      </div>

      <div className="actions">
        <button className="btn btn--ghost btn--back" type="button" onClick={back} tabIndex={tab}>
          <Chevron left />
          <span className="btn__label">Setor</span>
        </button>
        {seat && !seat.taken && (
          <>
            {/* atalho: ver o jogo da cadeira sem passar pelo zoom */}
            <button className="btn btn--ghost" type="button" onClick={() => openPov('seat')} tabIndex={tab}>
              <EyeIcon />
              Ver a vista
            </button>
            {owned ? (
              <button className="btn btn--primary" type="button" onClick={() => openWallet(owned.id)} tabIndex={tab}>
                Ver ingresso
              </button>
            ) : (
              <button className="btn btn--primary" type="button" onClick={openSeat} tabIndex={tab}>
                Continuar
                <Chevron />
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
