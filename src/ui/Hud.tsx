import { useEffect } from 'react'
import { useExperience } from '../store/experience'
import { Header } from './Header'
import { IntroOverlay } from './IntroOverlay'
import { OverviewPanel } from './OverviewPanel'

function useBootScreen(done: boolean) {
  useEffect(() => {
    if (!done) return
    const boot = document.getElementById('boot')
    if (!boot) return
    boot.classList.add('boot--done')
    const remove = () => boot.remove()
    boot.addEventListener('transitionend', remove, { once: true })
    const fallback = window.setTimeout(remove, 1500)
    return () => window.clearTimeout(fallback)
  }, [done])
}

export function Hud() {
  const phase = useExperience((s) => s.phase)
  useBootScreen(phase !== 'loading')
  const aerial = phase === 'aerial'

  return (
    <div className="hud">
      <IntroOverlay />
      <Header visible={aerial} />
      <OverviewPanel visible={aerial} />
    </div>
  )
}
