import { type FormEvent, useEffect, useRef, useState } from 'react'
import { type PaymentMethod, SERVICE_FEE, useExperience } from '../store/experience'
import { Chevron } from './icons'
import { formatPrice } from '../lib/blocks'
import { describeItem, METHOD_LABELS } from './ticketInfo'

const METHODS: { id: PaymentMethod; note: string }[] = [
  { id: 'pix', note: 'Aprovação na hora' },
  { id: 'card', note: 'Em até 3x sem juros' },
  { id: 'wallet', note: 'Apple Pay ou Google Pay' },
]

/**
 * Pagamento fictício: resumo, taxa, total, nome no ingresso e a forma de
 * pagamento. Não há campos de cartão e nada sai do navegador.
 */
export function CheckoutPanel({ visible }: { visible: boolean }) {
  const item = useExperience((s) => s.checkoutItem)
  const back = useExperience((s) => s.back)
  const confirmPurchase = useExperience((s) => s.confirmPurchase)
  const [name, setName] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [paying, setPaying] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  // ao abrir de novo, o botão volta ao normal
  const [shownFor, setShownFor] = useState(visible)
  if (visible !== shownFor) {
    setShownFor(visible)
    if (visible) setPaying(false)
  }
  if (!item) return null

  const describe = describeItem(item)
  const fee = Math.round(item.price * SERVICE_FEE)
  const total = item.price + fee
  const tab = visible ? 0 : -1

  const pay = (event: FormEvent) => {
    event.preventDefault()
    if (paying) return
    setPaying(true)
    // um instante de "processando", como num pagamento de verdade
    timer.current = window.setTimeout(() => confirmPurchase(name, method), 1400)
  }

  return (
    <div className="sheet" data-visible={visible} aria-hidden={!visible}>
      <form className="sheet__card glass" onSubmit={pay} aria-label="Pagamento">
        <header className="sheet__head">
          <button className="browse__btn" type="button" onClick={back} tabIndex={tab} aria-label="Voltar">
            <Chevron left />
          </button>
          <h2 className="sheet__title">Pagamento</h2>
        </header>

        <div className="summary">
          <p className="summary__label">{describe.label}</p>
          <p className="summary__title">{describe.title}</p>
          <p className="summary__subtitle">{describe.subtitle}</p>
        </div>

        <dl className="bill">
          <div>
            <dt>{describe.label}</dt>
            <dd>{formatPrice(item.price)}</dd>
          </div>
          <div>
            <dt>Taxa de serviço ({Math.round(SERVICE_FEE * 100)}%)</dt>
            <dd>{formatPrice(fee)}</dd>
          </div>
          <div className="bill__total">
            <dt>Total</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
        </dl>

        <label className="field">
          <span>Nome no ingresso</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como vai aparecer no ingresso"
            maxLength={40}
            autoComplete="off"
            tabIndex={tab}
          />
        </label>

        <fieldset className="methods">
          <legend>Forma de pagamento</legend>
          {METHODS.map((m) => (
            <label key={m.id} className="method" data-checked={method === m.id}>
              <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} tabIndex={tab} />
              <span className="method__name">{METHOD_LABELS[m.id]}</span>
              <span className="method__note">{m.note}</span>
            </label>
          ))}
        </fieldset>

        <p className="demo-note">Demonstração: nenhum pagamento é feito e nenhum dado sai do seu navegador.</p>

        <button className="btn btn--primary btn--wide" type="submit" disabled={paying} tabIndex={tab}>
          {paying ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Processando…
            </>
          ) : (
            `Pagar ${formatPrice(total)}`
          )}
        </button>
      </form>
    </div>
  )
}
