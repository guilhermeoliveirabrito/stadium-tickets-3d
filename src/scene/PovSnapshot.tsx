import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { useExperience } from '../store/experience'
import { cameraState } from './cameraState'

const WIDTH = 640
const HEIGHT = 360

/**
 * Foto da vista da cadeira para o ingresso: logo que a câmera termina de
 * "sentar", copia a imagem da tela (já com todos os efeitos) num canvas
 * pequeno, recortada em 16:9. Roda depois do desenho do quadro (prioridade 2),
 * quando a imagem ainda está no canvas.
 */
export function PovSnapshot() {
  const gl = useThree((s) => s.gl)
  const settled = useRef(0)

  useFrame((_, delta) => {
    const s = useExperience.getState()
    if (s.phase !== 'pov' || !cameraState.povReady || s.selectedSeat < 0) {
      settled.current = 0
      return
    }
    if (s.povShot?.seat === s.selectedSeat) return
    // alguns quadros parados antes da foto
    settled.current += delta
    if (settled.current < 0.35) return
    const source = gl.domElement
    let cropW = source.width
    let cropH = (source.width * HEIGHT) / WIDTH
    if (cropH > source.height) {
      cropH = source.height
      cropW = (source.height * WIDTH) / HEIGHT
    }
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(source, (source.width - cropW) / 2, (source.height - cropH) / 2, cropW, cropH, 0, 0, WIDTH, HEIGHT)
    s.setPovShot({ seat: s.selectedSeat, url: canvas.toDataURL('image/jpeg', 0.84) })
  }, 2)

  return null
}
