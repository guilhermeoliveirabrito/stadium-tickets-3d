import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { MathUtils, type PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { getSkyboxes } from '../lib/skyboxes'
import { povKey, useExperience } from '../store/experience'
import { boxEye, type Eye, POV_HFOV, seatEye } from './cameraPoses'
import { cameraState } from './cameraState'
import { selectionUniforms } from './selection'

const WIDTH = 640
const HEIGHT = 360
const ASPECT = WIDTH / HEIGHT
/** tempo (s) com a câmera parada antes da foto */
const SETTLE = 0.4

/** Copia o centro da imagem da tela (já com os efeitos), recortado em 16:9, para um JPEG pequeno. */
function capture(source: HTMLCanvasElement) {
  let cropW = source.width
  let cropH = cropW / ASPECT
  if (cropH > source.height) {
    cropH = source.height
    cropW = cropH * ASPECT
  }
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, (source.width - cropW) / 2, (source.height - cropH) / 2, cropW, cropH, 0, 0, WIDTH, HEIGHT)
  return canvas.toDataURL('image/jpeg', 0.84)
}

/**
 * Abertura vertical para que o recorte 16:9 do centro da tela mostre a vista
 * com a abertura horizontal da vista do lugar, seja qual for a proporção da tela.
 */
function captureFov(screenAspect: number) {
  const tanH = Math.tan(MathUtils.degToRad(POV_HFOV / 2))
  const tanV = screenAspect <= ASPECT ? tanH / screenAspect : tanH / ASPECT
  return MathUtils.radToDeg(2 * Math.atan(tanV))
}

/** Lugar cuja vista a foto mostra, conforme a etapa (ou nenhum). */
function viewTarget() {
  const s = useExperience.getState()
  if (s.phase === 'seat' && s.selectedSeat >= 0) return { kind: 'seat' as const, index: s.selectedSeat }
  if (s.phase === 'box' && s.selectedBox >= 0) return { kind: 'box' as const, index: s.selectedBox }
  if (s.phase === 'pov') {
    const index = s.povKind === 'seat' ? s.selectedSeat : s.selectedBox
    if (index >= 0) return { kind: s.povKind, index }
  }
  return null
}

/**
 * Foto da vista do lugar, para o cartão da cadeira, o painel do camarote e o
 * ingresso. Logo que a câmera para na cadeira (ou no camarote), um quadro é
 * desenhado do ponto de vista de quem senta ali, copiado e substituído pelo
 * quadro normal antes de ir para a tela: a pessoa não vê nada, e a prévia é a
 * vista de verdade (antes aparecia um desenho genérico até a primeira visita).
 */
export function PovSnapshot() {
  const gl = useThree((s) => s.gl)
  const settled = useRef(0)
  const scratch = useMemo(
    () => ({
      position: new Vector3(),
      quaternion: new Quaternion(),
      eye: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 0 } as Eye,
      saved: { hover: 0, select: 0, focus: 0, hoverSeat: 0, selectSeat: 0, hoverBox: 0, selectBox: 0 },
    }),
    [],
  )

  // Antes do desenho normal do quadro (o compositor desenha com prioridade 1).
  useFrame((state, delta) => {
    const target = viewTarget()
    const s = useExperience.getState()
    if (!target || s.phase === 'pov' || cameraState.moving || !cameraState.composer) {
      settled.current = 0
      return
    }
    const key = povKey(target.kind, target.index)
    if (s.povShots[key]) return
    settled.current += delta
    if (settled.current < SETTLE) return

    const camera = state.camera as PerspectiveCamera
    const { position, quaternion, eye, saved } = scratch
    const screenAspect = state.size.width / state.size.height
    if (target.kind === 'seat') seatEye(target.index, screenAspect, eye)
    else boxEye(getSkyboxes()[target.index], screenAspect, eye)

    // guarda a câmera e o destaque (de dentro do lugar nada fica destacado)
    position.copy(camera.position)
    quaternion.copy(camera.quaternion)
    const fov = camera.fov
    const near = camera.near
    const view = camera.view?.enabled ? { ...camera.view } : null
    const u = selectionUniforms
    Object.assign(saved, {
      hover: u.uHoverBlock.value,
      select: u.uSelectBlock.value,
      focus: u.uFocusBlock.value,
      hoverSeat: u.uHoverSeat.value,
      selectSeat: u.uSelectSeat.value,
      hoverBox: u.uHoverBox.value,
      selectBox: u.uSelectBox.value,
    })
    for (const uniform of Object.values(u)) if (uniform !== u.uPulse) uniform.value = -1

    camera.clearViewOffset()
    camera.position.set(eye.x, eye.y, eye.z)
    camera.lookAt(
      eye.x + Math.sin(eye.yaw) * Math.cos(eye.pitch),
      eye.y + Math.sin(eye.pitch),
      eye.z + Math.cos(eye.yaw) * Math.cos(eye.pitch),
    )
    camera.fov = captureFov(screenAspect)
    camera.near = 0.12
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    let url: string | null = null
    try {
      cameraState.composer.render(0)
      url = capture(gl.domElement)
    } finally {
      // tudo de volta; o compositor desenha o quadro normal em seguida
      camera.position.copy(position)
      camera.quaternion.copy(quaternion)
      camera.fov = fov
      camera.near = near
      if (view) camera.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height)
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      u.uHoverBlock.value = saved.hover
      u.uSelectBlock.value = saved.select
      u.uFocusBlock.value = saved.focus
      u.uHoverSeat.value = saved.hoverSeat
      u.uSelectSeat.value = saved.selectSeat
      u.uHoverBox.value = saved.hoverBox
      u.uSelectBox.value = saved.selectBox
    }
    if (url) s.setPovShot(key, url)
  }, 0.5)

  // Na própria vista do lugar, se a foto ainda não existe: copia a imagem da
  // tela logo depois de desenhada (prioridade 2, depois do compositor).
  useFrame((_, delta) => {
    const s = useExperience.getState()
    const target = viewTarget()
    if (s.phase !== 'pov' || !target || !cameraState.povReady) return
    const key = povKey(target.kind, target.index)
    if (s.povShots[key]) return
    settled.current += delta
    if (settled.current < SETTLE) return
    const url = capture(gl.domElement)
    if (url) s.setPovShot(key, url)
  }, 2)

  return null
}
