import { HAS_WEBGL2 } from './config/quality'
import { Experience } from './scene/Experience'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Fallback } from './ui/Fallback'
import { Hud } from './ui/Hud'

export default function App() {
  if (!HAS_WEBGL2) return <Fallback reason="webgl" />
  return (
    <ErrorBoundary fallback={<Fallback reason="error" />}>
      <main className="app">
        <Experience />
        <Hud />
      </main>
    </ErrorBoundary>
  )
}
