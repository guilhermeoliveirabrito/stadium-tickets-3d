import { useEffect } from 'react'
import { useExperience } from '../store/experience'
import { BlockPanel } from './BlockPanel'
import { BoxPanel } from './BoxPanel'
import { CheckoutPanel } from './CheckoutPanel'
import { useBootSequence } from './bootSequence'
import { Header } from './Header'
import { IntroOverlay } from './IntroOverlay'
import { OverviewPanel } from './OverviewPanel'
import { PovPanel } from './PovPanel'
import { SeatPanel } from './SeatPanel'
import { SectorPanel } from './SectorPanel'
import { TicketPanel } from './TicketPanel'

/** Esc volta uma etapa (bloco → setor → visão geral). */
function useBackKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useExperience.getState().back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function Hud() {
  const phase = useExperience((s) => s.phase)
  useBootSequence()
  useBackKey()
  // a cada etapa o cursor volta ao normal (o objeto sob ele pode ter deixado de ser clicável)
  useEffect(() => {
    document.body.style.cursor = ''
  }, [phase])
  const choosing = phase !== 'loading' && phase !== 'intro'
  // etapas do cabeçalho: setor, cadeira (ou camarote), pagamento; no ingresso, todas feitas
  const step =
    phase === 'checkout' ? 2 : phase === 'done' ? 3 : phase === 'block' || phase === 'seat' || phase === 'pov' || phase === 'box' ? 1 : 0

  return (
    <div className="hud" data-phase={phase}>
      <IntroOverlay />
      <Header visible={choosing} step={step} />
      <OverviewPanel visible={phase === 'aerial'} />
      <SectorPanel visible={phase === 'sector'} />
      <BlockPanel visible={phase === 'block'} />
      <SeatPanel visible={phase === 'seat'} />
      <PovPanel visible={phase === 'pov'} />
      <BoxPanel visible={phase === 'box'} />
      <CheckoutPanel visible={phase === 'checkout'} />
      <TicketPanel visible={phase === 'done'} />
    </div>
  )
}
