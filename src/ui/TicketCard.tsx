import { EVENT } from '../config/event'
import { formatPrice } from '../lib/blocks'
import type { Order } from '../store/experience'
import { useOrderShot } from './useOrderShot'
import { LogoMark } from './Logo'
import { describeItem, METHOD_LABELS } from './ticketInfo'
import { StadiumMap, TicketCode } from './ticketParts'

/** O ingresso: partida, a vista do lugar, o mapa, o lugar, o portão, o titular e o código. */
export function TicketCard({ order }: { order: Order }) {
  const describe = describeItem(order)
  const shot = useOrderShot(order)

  return (
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
  )
}
