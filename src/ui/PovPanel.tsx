import { formatPrice, getBlockInfo } from '../lib/blocks'
import { getSkyboxes } from '../lib/skyboxes'
import { seatPlace, useExperience } from '../store/experience'
import { Chevron } from './icons'

/** Vista do lugar (primeira pessoa): de onde é a vista, a dica de arrastar e o caminho para comprar. */
export function PovPanel({ visible }: { visible: boolean }) {
  const povKind = useExperience((s) => s.povKind)
  const selectedSeat = useExperience((s) => s.selectedSeat)
  const selectedBlock = useExperience((s) => s.selectedBlock)
  const selectedBox = useExperience((s) => s.selectedBox)
  const order = useExperience((s) => s.order)
  const openCheckout = useExperience((s) => s.openCheckout)
  const back = useExperience((s) => s.back)
  const startOver = useExperience((s) => s.startOver)
  const tab = visible ? 0 : -1

  const isBox = povKind === 'box'
  if (isBox ? selectedBox < 0 : selectedSeat < 0 || selectedBlock < 0) return null
  const box = isBox ? getSkyboxes()[selectedBox] : null
  const where = box ? `Vista do Camarote ${box.number}` : `Sua vista · ${seatPlace(selectedSeat)}`
  // visitando a vista depois da compra: em vez de comprar, recomeçar
  const bought = box ? order?.kind === 'box' && order.box === box.index : order?.kind === 'seat' && order.seat === selectedSeat

  return (
    <div className="pov" data-visible={visible} aria-hidden={!visible}>
      <p className="pov__where glass">
        <span className="pov__dot" />
        {where}
      </p>
      <div className="pov__bar glass">
        <p className="pov__hint">Arraste para olhar em volta</p>
        <div className="actions">
          <button className="btn btn--ghost" type="button" onClick={back} tabIndex={tab}>
            <Chevron left />
            Voltar
          </button>
          {bought ? (
            <button className="btn btn--primary" type="button" onClick={startOver} tabIndex={tab}>
              Comprar outro ingresso
            </button>
          ) : box ? (
            <button className="btn btn--primary" type="button" onClick={() => openCheckout('box')} tabIndex={tab} disabled={box.sold}>
              {box.sold ? 'Vendido' : `Comprar · ${formatPrice(box.price)}`}
            </button>
          ) : (
            <button className="btn btn--primary" type="button" onClick={() => openCheckout('seat')} tabIndex={tab}>
              Comprar · {formatPrice(getBlockInfo(selectedBlock).price)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
