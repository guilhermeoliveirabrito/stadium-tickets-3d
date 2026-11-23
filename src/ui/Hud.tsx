import { useEffect } from 'react'
import { useExperience } from '../store/experience'
import { BlockPanel } from './BlockPanel'
import { BoxPanel } from './BoxPanel'
import { useBootSequence } from './bootSequence'
import { Header } from './Header'
import { IntroOverlay } from './IntroOverlay'
import { OverviewPanel } from './OverviewPanel'
import { SectorPanel } from './SectorPanel'

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
  const choosing = phase === 'aerial' || phase === 'sector' || phase === 'block' || phase === 'box'

  return (
    <div className="hud" data-phase={phase}>
      <IntroOverlay />
      <Header visible={choosing} step={phase === 'block' || phase === 'box' ? 1 : 0} />
      <OverviewPanel visible={phase === 'aerial'} />
      <SectorPanel visible={phase === 'sector'} />
      <BlockPanel visible={phase === 'block'} />
      <BoxPanel visible={phase === 'box'} />
    </div>
  )
}
