import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { introDisabled, useExperience } from '../store/experience'

/**
 * Avisa que a cena está pronta depois que os primeiros quadros foram
 * processados (eles ainda compilam os shaders do pós-processamento). A
 * abertura de texto (src/ui/bootSequence.ts) decide quando a câmera começa.
 */
export function ReadySignal({ frames = 2, skipIntro = false }: { frames?: number; skipIntro?: boolean }) {
  const count = useRef(0)
  useFrame(() => {
    if (count.current >= frames) return
    count.current++
    if (count.current === frames) {
      const { phase, setPhase, setSceneReady } = useExperience.getState()
      setSceneReady()
      if (phase === 'loading' && (introDisabled || skipIntro)) setPhase('aerial')
    }
  })
  return null
}
