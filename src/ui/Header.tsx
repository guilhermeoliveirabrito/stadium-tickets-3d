import { EVENT } from '../config/event'
import { LogoMark } from './Logo'

const STEPS = ['Setor', 'Cadeira', 'Pagamento']

export function Header({ visible, step = 0 }: { visible: boolean; step?: number }) {
  return (
    <header className="topbar" data-visible={visible}>
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
          {EVENT.date} · {EVENT.time}
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
    </header>
  )
}
