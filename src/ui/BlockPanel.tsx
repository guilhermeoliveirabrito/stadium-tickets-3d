import { useState } from 'react'
import { formatPrice, getBlockInfo, seatLabel } from '../lib/blocks'
import { useExperience } from '../store/experience'

const canHover = window.matchMedia('(hover: hover)').matches

/** Painel da escolha da cadeira, com a legenda e o resumo da cadeira escolhida. */
export function BlockPanel({ visible }: { visible: boolean }) {
  const selectedBlock = useExperience((s) => s.selectedBlock)
  const selectedSeat = useExperience((s) => s.selectedSeat)
  const back = useExperience((s) => s.back)
  const [shown, setShown] = useState(selectedBlock)
  if (selectedBlock >= 0 && selectedBlock !== shown) setShown(selectedBlock)
  if (shown < 0) return null

  const info = getBlockInfo(shown)
  const seat = selectedSeat >= 0 ? seatLabel(selectedSeat) : null

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
      </ul>

      <div className="picked" data-empty={!seat}>
        {seat ? (
          <>
            <div>
              <p className="picked__label">Sua cadeira</p>
              <p className="picked__seat">
                Fileira {seat.row} · Cadeira {seat.number}
              </p>
            </div>
            <p className="picked__price">{formatPrice(info.price)}</p>
          </>
        ) : (
          <p className="picked__label">Nenhuma cadeira escolhida</p>
        )}
      </div>

      <div className="actions">
        <button className="btn btn--ghost" type="button" onClick={back} tabIndex={visible ? 0 : -1}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Setor
        </button>
      </div>
    </section>
  )
}
