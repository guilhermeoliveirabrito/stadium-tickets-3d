import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type { Object3D } from 'three'
import { introDisabled, useExperience } from '../store/experience'

/**
 * Avisa que a cena está pronta depois que os primeiros quadros foram
 * processados. A abertura de texto (src/ui/bootSequence.ts) decide quando a
 * câmera começa.
 *
 * O primeiro quadro (ainda atrás da tela de carregamento) desenha tudo, mesmo
 * o que está fora da tela ou escondido. Assim todas as geometrias e texturas
 * são enviadas à placa de vídeo de uma vez, e não aos poucos no meio da
 * abertura, quando cada parte da cidade entra em cena pela primeira vez.
 */
export function ReadySignal({ frames = 3, skipIntro = false }: { frames?: number; skipIntro?: boolean }) {
  const scene = useThree((s) => s.scene)
  const count = useRef(0)
  const restore = useRef<{ object: Object3D; culled: boolean; visible: boolean }[]>([])

  useFrame(() => {
    if (count.current > frames) return
    count.current++
    if (count.current === 1) {
      scene.traverse((object) => {
        restore.current.push({ object, culled: object.frustumCulled, visible: object.visible })
        object.frustumCulled = false
        object.visible = true
      })
    } else if (count.current === 2) {
      for (const { object, culled, visible } of restore.current) {
        object.frustumCulled = culled
        object.visible = visible
      }
      restore.current = []
    }
    if (count.current === frames) {
      const { phase, setPhase, setSceneReady } = useExperience.getState()
      setSceneReady()
      if (phase === 'loading' && (introDisabled || skipIntro)) setPhase('aerial')
    }
  })
  return null
}
