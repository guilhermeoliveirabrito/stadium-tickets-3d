import { EVENT } from '../config/event'
import { povKey, useExperience } from '../store/experience'
import { CheckIcon, EyeIcon } from './icons'
import { LogoMark } from './Logo'
import { formatPrice } from '../lib/blocks'
import { describeItem, METHOD_LABELS } from './ticketInfo'
import { StadiumMap, TicketCode } from './ticketParts'

/** Compra concluída: o ingresso com a vista do lugar, o mapa, o código e os dados do pedido. */
export function TicketPanel({ visible }: { visible: boolean }) {
  const order = useExperience((s) => s.order)
  const povShots = useExperience((s) => s.povShots)
  const openPov = useExperience((s) => s.openPov)
  const startOver = useExperience((s) => s.startOver)
  if (!order) return null

  const describe = describeItem(order)
  const shot = povShots[povKey(order.kind, order.kind === 'seat' ? order.seat : order.box)] ?? null
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

        <article className="ticket" aria-label="Ingresso">
          <header className="ticket__head">
            <span className="ticket__brand">
              <LogoMark />
              tribuna
            </span>
            <span className="ticket__stage">
              {EVENT.stage} · {EVENT.season}
            </span>
          </header>

          <p className="ticket__match">
            {EVENT.home.name} <span>×</span> {EVENT.away.name}
          </p>
          <p className="ticket__when">
            {EVENT.date} · {EVENT.time} · {EVENT.stadium}
          </p>

          <div className="ticket__visual">
            {shot ? <img className="ticket__view" src={shot} alt="Vista do campo a partir do seu lugar" /> : null}
            <StadiumMap item={order} />
          </div>

          <p className="ticket__place">{describe.title}</p>
          <p className="ticket__sub">{describe.subtitle}</p>
          <dl className="ticket__grid">
            {describe.details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="ticket__tear" aria-hidden="true" />

          <div className="ticket__foot">
            <TicketCode value={order.id} />
            <dl className="ticket__meta">
              <div>
                <dt>Titular</dt>
                <dd>{order.name || 'Torcedor'}</dd>
              </div>
              <div>
                <dt>Pedido</dt>
                <dd>{order.id}</dd>
              </div>
              <div>
                <dt>Pago</dt>
                <dd>
                  {formatPrice(order.total)} · {METHOD_LABELS[order.method]}
                </dd>
              </div>
            </dl>
          </div>
          <p className="ticket__demo">Ingresso de demonstração · código ilustrativo</p>
        </article>

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
