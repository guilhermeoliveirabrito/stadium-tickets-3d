import { EVENT } from '../config/event'
import { useExperience } from '../store/experience'
import { TicketIcon } from './icons'
import { LogoMark } from './Logo'

const STEPS = ['Setor', 'Cadeira', 'Pagamento']

export function Header({ visible, step = 0 }: { visible: boolean; step?: number }) {
  const count = useExperience((s) => s.orders.length)
  const openWallet = useExperience((s) => s.openWallet)
  return (
    <header className="topbar" data-visible={visible} data-wallet={count > 0}>
      <a className="brand glass" href="./" aria-label="Tribuna, página inicial">
        <LogoMark />
        <span>tribuna</span>
      </a>

      <div className="event glass">
        <span className="event__teams">
          <span className="crest crest--home">{EVENT.home.short}</span>
          {EVENT.home.name}
          <span className="event__vs">×</span>
          {EVENT.away.name}
          <span className="crest crest--away">{EVENT.away.short}</span>
        </span>
        <span className="event__sep" />
        <span className="event__meta">
          <span className="event__date">{EVENT.date}</span>
          <span className="event__date event__date--short">{EVENT.shortDate}</span> · {EVENT.time}
        </span>
        <span className="event__sep event__sep--wide" />
        <span className="event__meta event__meta--wide">{EVENT.stadium}</span>
      </div>

      <ol className="steps glass" aria-label="Etapas da compra">
        {STEPS.map((label, i) => (
          <li key={label} className={`step${i === step ? ' step--active' : ''}${i < step ? ' step--done' : ''}`}>
            <span className="step__n">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {count > 0 && (
        // a chave muda a cada compra: o botão "pula" para mostrar onde o ingresso foi parar
        <button key={count} className="wallet-btn glass" type="button" onClick={() => openWallet()} aria-label={`Meus ingressos (${count})`}>
          <TicketIcon />
          <span className="wallet-btn__label">Meus ingressos</span>
          <span className="wallet-btn__count">{count}</span>
        </button>
      )}
    </header>
  )
}
