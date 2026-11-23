import { useExperience } from '../store/experience'

/**
 * Botão de pular a abertura. O texto da abertura (local, times e título) vem
 * do index.html, para aparecer antes do JavaScript; ver src/ui/bootSequence.ts.
 */
export function IntroOverlay() {
  const phase = useExperience((s) => s.phase)
  const skipped = useExperience((s) => s.introSkipped)
  const skipIntro = useExperience((s) => s.skipIntro)
  const visible = (phase === 'loading' || phase === 'intro') && !skipped

  return (
    <div className="intro" data-visible={visible} aria-hidden={!visible}>
      <button className="skip" type="button" onClick={skipIntro} tabIndex={visible ? 0 : -1}>
        Pular intro
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
