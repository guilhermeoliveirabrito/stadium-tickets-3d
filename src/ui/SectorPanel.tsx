import { useState } from 'react'
import { formatPrice, getBlockInfo } from '../lib/blocks'
import { useExperience } from '../store/experience'

const number = new Intl.NumberFormat('pt-BR')

/** Painel do setor escolhido: preço, lugares livres e o caminho para as cadeiras. */
export function SectorPanel({ visible }: { visible: boolean }) {
  const selectedBlock = useExperience((s) => s.selectedBlock)
  const openBlock = useExperience((s) => s.openBlock)
  const back = useExperience((s) => s.back)
  // mantém o último bloco enquanto o painel some, para o conteúdo não sumir antes dele
  const [shown, setShown] = useState(selectedBlock)
  if (selectedBlock >= 0 && selectedBlock !== shown) setShown(selectedBlock)
  if (shown < 0) return null

  const info = getBlockInfo(shown)
  const { available, seatCount } = info.block
  const share = available / seatCount

  return (
    <section className="panel glass" data-visible={visible} aria-label="Setor escolhido" aria-hidden={!visible}>
      <p className="panel__kicker">
        {info.standName} · {info.tierName}
      </p>
      <h2 className="panel__title">Bloco {info.block.number}</h2>
      <ul className="chips">
        <li className="chip">{info.view}</li>
        <li className="chip">{info.heightNote}</li>
        <li className="chip">{info.block.rows} fileiras</li>
      </ul>

      <p className="price">
        <strong>{formatPrice(info.price)}</strong>
        <span>por ingresso</span>
      </p>

      <div className="availability">
        <p className="availability__text">
          <span>
            <b>{number.format(available)}</b> de {number.format(seatCount)} lugares livres
          </span>
          <span>{Math.round(share * 100)}%</span>
        </p>
        <div className="availability__bar">
          <span className="availability__fill" style={{ transform: `scaleX(${share})` }} />
        </div>
      </div>

      <div className="actions">
        <button className="btn btn--ghost" type="button" onClick={back} tabIndex={visible ? 0 : -1}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Visão geral
        </button>
        <button className="btn btn--primary" type="button" onClick={openBlock} tabIndex={visible ? 0 : -1} disabled={available === 0}>
          Escolher cadeira
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  )
}
