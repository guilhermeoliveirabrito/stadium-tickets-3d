import { useEffect } from 'react'
import { useExperience } from '../store/experience'

declare global {
  interface Window {
    /** momento em que a abertura de texto começou (script no index.html) */
    __bootStart?: number
  }
}

/**
 * Quanto tempo depois do início a sequência de texto do index.html termina
 * de montar o título (local → times → "Arena Aurora"). Se a cena ficar pronta
 * antes, a câmera espera o título; se demorar mais, o título fica na tela.
 */
const TITLE_SETTLED_MS = 5400
const MOVE_MS = 1600
const EXIT_MS = 900

function getBoot() {
  return document.getElementById('boot')
}

/**
 * Quanto falta para o título terminar de aparecer (0 se já apareceu, se a
 * abertura foi pulada ou se não há abertura). O envio pesado de dados para a
 * placa de vídeo espera esse momento: feito no meio da animação, ele pode
 * travar o desenho da tela por alguns instantes e a animação pular.
 */
export function bootTitleRemainingMs() {
  const { introSkipped, phase } = useExperience.getState()
  if (!getBoot() || introSkipped || phase !== 'loading') return 0
  return Math.max(0, TITLE_SETTLED_MS - (performance.now() - (window.__bootStart ?? 0)))
}

/**
 * Leva cada linha do título do centro da tela para o canto inferior esquerdo
 * (técnica FLIP: mede antes e depois da troca de layout e anima a diferença
 * só com transform). O fundo preto some ao mesmo tempo, revelando a cena.
 */
function handoff(boot: HTMLElement) {
  if (boot.dataset.state) return
  boot.dataset.state = 'handoff'
  const lines = Array.from(boot.querySelectorAll<HTMLElement>('.boot__line'))
  const first = lines.map((line) => line.getBoundingClientRect())
  boot.classList.add('boot--handoff')
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const last = lines.map((line) => line.getBoundingClientRect())
  lines.forEach((line, i) => {
    const scale = first[i].width / Math.max(1, last[i].width)
    line.style.transformOrigin = '0 0'
    line.style.transition = 'none'
    line.style.transform = `translate(${first[i].left - last[i].left}px, ${first[i].top - last[i].top}px) scale(${scale})`
  })
  // aplica a posição inicial antes de ligar a transição
  void boot.offsetWidth
  // a linha de baixo sai primeiro: como todas descem, assim uma não passa por cima da outra
  lines.forEach((line, i) => {
    line.style.transition = `transform ${MOVE_MS}ms cubic-bezier(0.65, 0, 0.35, 1) ${(lines.length - 1 - i) * 70}ms`
    line.style.transform = ''
  })
}

/** Some com a abertura de texto (fim da abertura, ou quando ela é pulada). */
function exit(boot: HTMLElement) {
  if (boot.dataset.state === 'exit') return
  boot.dataset.state = 'exit'
  boot.classList.add('boot--exit')
  window.setTimeout(() => boot.remove(), EXIT_MS + 100)
}

/**
 * Controla a passagem da abertura de texto (index.html) para a abertura da
 * câmera: espera a cena ficar pronta e o título terminar de aparecer, desce o
 * título para o canto, revela a cena e só então solta a câmera.
 */
export function useBootSequence() {
  const sceneReady = useExperience((s) => s.sceneReady)
  const phase = useExperience((s) => s.phase)
  const skipped = useExperience((s) => s.introSkipped)
  const setPhase = useExperience((s) => s.setPhase)

  useEffect(() => {
    if (!sceneReady || phase !== 'loading') return
    const elapsed = performance.now() - (window.__bootStart ?? 0)
    const wait = skipped ? 0 : Math.max(0, TITLE_SETTLED_MS - elapsed)
    const timer = window.setTimeout(() => {
      const boot = getBoot()
      if (boot) {
        if (useExperience.getState().introSkipped) exit(boot)
        else handoff(boot)
      }
      setPhase('intro')
    }, wait)
    return () => window.clearTimeout(timer)
  }, [sceneReady, phase, skipped, setPhase])

  useEffect(() => {
    if (phase === 'aerial' || (phase === 'intro' && skipped)) {
      const boot = getBoot()
      if (boot) exit(boot)
    }
  }, [phase, skipped])
}
