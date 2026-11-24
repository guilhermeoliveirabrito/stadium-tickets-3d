import { useExperience } from '../store/experience'
import { CheckIcon, EyeIcon, TicketIcon } from './icons'
import { TicketCard } from './TicketCard'

/** Compra concluída: o ingresso, o caminho para a vista do lugar e onde ele fica guardado. */
export function TicketPanel({ visible }: { visible: boolean }) {
  const order = useExperience((s) => s.order)
  const openPov = useExperience((s) => s.openPov)
  const openWallet = useExperience((s) => s.openWallet)
  const startOver = useExperience((s) => s.startOver)
  if (!order) return null
  const tab = visible ? 0 : -1

  return (
    <div className="sheet sheet--ticket" data-visible={visible} aria-hidden={!visible}>
      <div className="sheet__card sheet__card--ticket">
        <p className="done">
          <span className="done__icon">
            <CheckIcon />
          </span>
          Compra confirmada
        </p>

        <TicketCard order={order} />

        <button className="saved" type="button" onClick={() => openWallet()} tabIndex={tab}>
          <TicketIcon />
          <span>
            Guardado em <b>Meus ingressos</b>, no alto da tela
          </span>
        </button>

        <div className="actions">
          <button className="btn btn--ghost" type="button" onClick={() => openPov(order.kind)} tabIndex={tab}>
            <EyeIcon />
            {order.kind === 'seat' ? 'Ver do meu lugar' : 'Ver do camarote'}
          </button>
          <button className="btn btn--primary" type="button" onClick={startOver} tabIndex={tab}>
            Comprar outro ingresso
          </button>
        </div>
      </div>
    </div>
  )
}
