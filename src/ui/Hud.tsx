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
import { WalletPanel } from './WalletPanel'

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
  // com "Meus ingressos" aberto, os painéis da etapa saem de cena (e voltam ao fechar)
  const walletOpen = useExperience((s) => s.walletOpen)
  const show = (p: string) => phase === p && !walletOpen
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
      <OverviewPanel visible={show('aerial')} />
      <SectorPanel visible={show('sector')} />
      <BlockPanel visible={show('block')} />
      <SeatPanel visible={show('seat')} />
      <PovPanel visible={show('pov')} />
      <BoxPanel visible={show('box')} />
      <CheckoutPanel visible={show('checkout')} />
      <TicketPanel visible={show('done')} />
      <WalletPanel />
    </div>
  )
}
