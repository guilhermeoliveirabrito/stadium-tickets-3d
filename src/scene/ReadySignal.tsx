import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { introDisabled, useExperience } from '../store/experience'

/** Libera a abertura depois que os primeiros quadros (e shaders) foram processados. */
export function ReadySignal({ frames = 3, skipIntro = false }: { frames?: number; skipIntro?: boolean }) {
  const count = useRef(0)
  useFrame(() => {
    if (count.current > frames) return
    count.current++
    if (count.current === frames) {
      const { phase, setPhase } = useExperience.getState()
      if (phase === 'loading') setPhase(introDisabled || skipIntro ? 'aerial' : 'intro')
    }
  })
  return null
}
