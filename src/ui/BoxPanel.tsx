import { useState } from 'react'
import { formatPrice } from '../lib/blocks'
import { getSkyboxes, SKYBOX_AMENITIES } from '../lib/skyboxes'
import { povKey, useExperience } from '../store/experience'
import { Chevron, EyeIcon } from './icons'

/** Painel do camarote: preço do camarote inteiro, lugares, o que está incluso e a compra. */
export function BoxPanel({ visible }: { visible: boolean }) {
  const selectedBox = useExperience((s) => s.selectedBox)
  const order = useExperience((s) => s.order)
  const boxFrom = useExperience((s) => s.boxFrom)
  const selectBox = useExperience((s) => s.selectBox)
  const openCheckout = useExperience((s) => s.openCheckout)
  const openPov = useExperience((s) => s.openPov)
  const povShots = useExperience((s) => s.povShots)
  const back = useExperience((s) => s.back)
  // mantém o último camarote enquanto o painel some
  const [shown, setShown] = useState(selectedBox)
  if (selectedBox >= 0 && selectedBox !== shown) setShown(selectedBox)
  if (shown < 0) return null

  const boxes = getSkyboxes()
  const box = boxes[shown]
  const bought = order?.kind === 'box' && order.box === box.index
  const shot = povShots[povKey('box', box.index)] ?? null
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

      <button className="pov-preview pov-preview--box" type="button" onClick={() => openPov('box')} tabIndex={tab} data-shot={!!shot}>
        {shot ? <img src={shot} alt="Vista do campo a partir do camarote" /> : <span className="pov-preview__loading" />}
        <span className="pov-preview__label">
          <EyeIcon />
          Ver o jogo do camarote
        </span>
      </button>

      <p className="price">
        <strong>{formatPrice(box.price)}</strong>
        <span>
          por camarote · {formatPrice(Math.round(box.price / box.capacity))} por pessoa
        </span>
      </p>
      <p className="status" data-sold={box.sold}>
        <span className="status__dot" />
        {box.sold ? 'Vendido para esta partida' : bought ? 'Comprado por você' : 'Disponível'}
      </p>

      <ul className="amenities">
        {SKYBOX_AMENITIES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="actions">
        <button className="btn btn--ghost" type="button" onClick={back} tabIndex={tab}>
          <Chevron left />
          {boxFrom === 'sector' ? 'Setor' : boxFrom === 'seat' ? 'Cadeira' : 'Visão geral'}
        </button>
        <button
          className="btn btn--primary"
          type="button"
          onClick={() => openCheckout('box')}
          tabIndex={tab}
          disabled={box.sold || bought}
          data-done={bought}
        >
          {box.sold ? 'Vendido' : bought ? 'Comprado ✓' : 'Comprar camarote'}
        </button>
      </div>
    </section>
  )
}
