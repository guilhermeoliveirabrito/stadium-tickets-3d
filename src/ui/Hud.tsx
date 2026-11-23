import { useExperience } from '../store/experience'
import { useBootSequence } from './bootSequence'
import { Header } from './Header'
import { IntroOverlay } from './IntroOverlay'
import { OverviewPanel } from './OverviewPanel'

export function Hud() {
  const phase = useExperience((s) => s.phase)
  useBootSequence()
  const aerial = phase === 'aerial'

  return (
    <div className="hud">
      <IntroOverlay />
      <Header visible={aerial} />
      <OverviewPanel visible={aerial} />
    </div>
  )
}
