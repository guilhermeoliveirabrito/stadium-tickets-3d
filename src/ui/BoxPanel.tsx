import { useState } from 'react'
import { formatPrice } from '../lib/blocks'
import { getSkyboxes, SKYBOX_AMENITIES } from '../lib/skyboxes'
import { useExperience } from '../store/experience'

function Chevron({ left = false }: { left?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={left ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Painel do camarote: preço do camarote inteiro, lugares, o que está incluso e a reserva. */
export function BoxPanel({ visible }: { visible: boolean }) {
  const selectedBox = useExperience((s) => s.selectedBox)
  const reservedBox = useExperience((s) => s.reservedBox)
  const boxFrom = useExperience((s) => s.boxFrom)
  const selectBox = useExperience((s) => s.selectBox)
  const reserveBox = useExperience((s) => s.reserveBox)
  const back = useExperience((s) => s.back)
  // mantém o último camarote enquanto o painel some
  const [shown, setShown] = useState(selectedBox)
  if (selectedBox >= 0 && selectedBox !== shown) setShown(selectedBox)
  if (shown < 0) return null

  const boxes = getSkyboxes()
  const box = boxes[shown]
  const reserved = reservedBox === box.index
  const tab = visible ? 0 : -1
  const browse = (step: number) => selectBox((box.index + step + boxes.length) % boxes.length)

  return (
    <section className="panel panel--box glass" data-visible={visible} aria-label="Camarote" aria-hidden={!visible}>
      <div className="panel__head">
        <p className="panel__kicker">Camarote VIP · {box.standName}</p>
        <div className="browse">
          <button type="button" className="browse__btn" onClick={() => browse(-1)} tabIndex={tab} aria-label="Camarote anterior">
            <Chevron left />
          </button>
          <button type="button" className="browse__btn" onClick={() => browse(1)} tabIndex={tab} aria-label="Próximo camarote">
            <Chevron />
          </button>
        </div>
      </div>
      <h2 className="panel__title">Camarote {box.number}</h2>
      <ul className="chips">
        <li className="chip">{box.view}</li>
        <li className="chip">{box.capacity} lugares</li>
        <li className="chip">Open bar</li>
      </ul>

      <p className="price">
        <strong>{formatPrice(box.price)}</strong>
        <span>
          por camarote · {formatPrice(Math.round(box.price / box.capacity))} por pessoa
        </span>
      </p>
      <p className="status" data-sold={box.sold}>
        <span className="status__dot" />
        {box.sold ? 'Vendido para esta partida' : reserved ? 'Reservado para você' : 'Disponível'}
      </p>

      <ul className="amenities">
        {SKYBOX_AMENITIES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="actions">
        <button className="btn btn--ghost" type="button" onClick={back} tabIndex={tab}>
          <Chevron left />
          {boxFrom === 'sector' ? 'Setor' : 'Visão geral'}
        </button>
        <button
          className="btn btn--primary"
          type="button"
          onClick={() => reserveBox(reserved ? -1 : box.index)}
          tabIndex={tab}
          disabled={box.sold}
          data-done={reserved}
        >
          {box.sold ? 'Vendido' : reserved ? 'Reservado ✓' : 'Reservar camarote'}
        </button>
      </div>
    </section>
  )
}
