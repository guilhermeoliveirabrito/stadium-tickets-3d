import { useState } from 'react'
import { formatPrice, getBlockInfo, seatLabel } from '../lib/blocks'
import { bestAvailableSkybox, getSkyboxes } from '../lib/skyboxes'
import { povKey, useExperience } from '../store/experience'
import { Chevron, EyeIcon } from './icons'

/**
 * Zoom na cadeira escolhida: o lugar, o preço, a prévia da vista (a foto
 * aparece depois da primeira visita ao POV) e a oferta de camarote.
 */
export function SeatPanel({ visible }: { visible: boolean }) {
  const selectedSeat = useExperience((s) => s.selectedSeat)
  const selectedBlock = useExperience((s) => s.selectedBlock)
  const povShots = useExperience((s) => s.povShots)
  const openPov = useExperience((s) => s.openPov)
  const openCheckout = useExperience((s) => s.openCheckout)
  const selectBox = useExperience((s) => s.selectBox)
  const back = useExperience((s) => s.back)
  // mantém o último lugar enquanto o painel some
  const [shown, setShown] = useState({ seat: selectedSeat, block: selectedBlock })
  if (selectedSeat >= 0 && selectedSeat !== shown.seat) setShown({ seat: selectedSeat, block: selectedBlock })
  if (shown.seat < 0 || shown.block < 0) return null

  const info = getBlockInfo(shown.block)
  const seat = seatLabel(shown.seat)
  const shot = povShots[povKey('seat', shown.seat)] ?? null
  const vip = getSkyboxes()[bestAvailableSkybox()]
  const tab = visible ? 0 : -1

  return (
    <section className="panel panel--seat glass" data-visible={visible} aria-label="Cadeira escolhida" aria-hidden={!visible}>
      <p className="panel__kicker">
        Bloco {info.block.number} · {info.tierName}
      </p>
      <h2 className="panel__title">
        Fileira {seat.row} · Cadeira {seat.number}
      </h2>
      <ul className="chips">
        <li className="chip">{info.standName.replace('Arquibancada ', 'Arq. ')}</li>
        <li className="chip">{info.view}</li>
        <li className="chip">{info.heightNote}</li>
      </ul>

      <button className="pov-preview" type="button" onClick={() => openPov('seat')} tabIndex={tab} data-shot={!!shot}>
        {/* a foto da vista chega logo que a câmera para na cadeira (ver PovSnapshot) */}
        {shot ? <img src={shot} alt="Vista do campo a partir da sua cadeira" /> : <span className="pov-preview__loading" />}
        <span className="pov-preview__label">
          <EyeIcon />
          Ver o jogo do meu lugar
        </span>
      </button>

      <p className="price">
        <strong>{formatPrice(info.price)}</strong>
        <span>por ingresso</span>
      </p>

      {vip && !vip.sold && (
        <div className="upsell">
          <p>
            <b>Prefere um camarote?</b> Open bar e buffet, a partir de {formatPrice(Math.round(vip.price / vip.capacity))} por pessoa
          </p>
          <button className="btn btn--small btn--ghost" type="button" onClick={() => selectBox(vip.index)} tabIndex={tab}>
            Ver
          </button>
        </div>
      )}

      <div className="actions">
        <button className="btn btn--ghost" type="button" onClick={back} tabIndex={tab}>
          <Chevron left />
          Trocar
        </button>
        <button className="btn btn--primary" type="button" onClick={() => openCheckout('seat')} tabIndex={tab}>
          Comprar ingresso
        </button>
      </div>
    </section>
  )
}
