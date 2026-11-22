import { EVENT } from '../config/event'
import { useExperience } from '../store/experience'

export function IntroOverlay() {
  const phase = useExperience((s) => s.phase)
  const skipped = useExperience((s) => s.introSkipped)
  const skipIntro = useExperience((s) => s.skipIntro)
  const visible = phase === 'intro' && !skipped

  return (
    <div className="intro" data-visible={visible} aria-hidden={!visible}>
      <div className="intro__scrim" />
      <div className="intro__copy">
        <p className="intro__kicker">
          <span>{EVENT.stage}</span>
          <span className="intro__dot" />
          <span>{EVENT.season}</span>
        </p>
        <h1 className="intro__title">
          <span>Arena</span> <span>Aurora</span>
        </h1>
        <p className="intro__meta">
          {EVENT.home.name} × {EVENT.away.name} — {EVENT.date} · {EVENT.time}
        </p>
      </div>
      <button className="skip" type="button" onClick={skipIntro} tabIndex={visible ? 0 : -1}>
        Pular intro
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
