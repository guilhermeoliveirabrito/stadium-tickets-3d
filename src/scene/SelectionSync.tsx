import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useExperience } from '../store/experience'
import { selectionUniforms } from './selection'

/** Copia o bloco e a cadeira em destaque do estado para os shaders. */
export function SelectionSync() {
  const clock = useRef(0)
  useFrame((_, delta) => {
    clock.current += delta
    const s = useExperience.getState()
    const u = selectionUniforms
    const browsing = s.phase === 'aerial' || s.phase === 'sector'
    u.uHoverBlock.value = browsing ? s.hoverBlock : -1
    u.uSelectBlock.value = s.phase === 'sector' ? s.selectedBlock : -1
    u.uFocusBlock.value = s.phase === 'block' ? s.selectedBlock : -1
    u.uHoverSeat.value = s.phase === 'block' ? s.hoverSeat : -1
    u.uSelectSeat.value = s.phase === 'block' ? s.selectedSeat : -1
    u.uHoverBox.value = browsing || s.phase === 'box' ? s.hoverBox : -1
    u.uSelectBox.value = s.phase === 'box' ? s.selectedBox : -1
    u.uPulse.value = 0.5 + 0.5 * Math.sin(clock.current * 3.2)
  })
  return null
}
