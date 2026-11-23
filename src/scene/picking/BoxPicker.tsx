import type { ThreeEvent } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial } from 'three'
import { SKYBOX } from '../../config/stadium'
import { frameAt, SEGMENTS } from '../../lib/bowl'
import { once } from '../../lib/once'
import { getSkyboxes } from '../../lib/skyboxes'
import { useExperience } from '../../store/experience'

/** Um retângulo invisível no vidro de cada camarote, só para o cursor. */
const getProxy = once(() => {
  const positions: number[] = []
  const triangleBox: number[] = []
  const d = SKYBOX.front - 0.03
  for (const box of getSkyboxes()) {
    const seg = SEGMENTS[box.segment]
    const len = seg.kind === 'line' ? seg.length : 1
    const half = (SKYBOX.width / 2 - 0.08) / len
    const a = frameAt(seg, box.center - half, d)
    const b = frameAt(seg, box.center + half, d)
    const quad = [
      [a.x, SKYBOX.floor, a.z],
      [b.x, SKYBOX.floor, b.z],
      [b.x, SKYBOX.ceiling, b.z],
      [a.x, SKYBOX.ceiling, a.z],
    ]
    for (const k of [0, 1, 2, 0, 2, 3]) positions.push(...quad[k])
    triangleBox.push(box.index, box.index)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()
  const material = new MeshBasicMaterial({ side: 2 })
  material.visible = false
  return { geometry, material, triangleBox }
})

const canHover = window.matchMedia('(hover: hover)').matches

export function BoxPicker() {
  const phase = useExperience((s) => s.phase)
  const active = phase === 'aerial' || phase === 'sector' || phase === 'box'
  if (!active) return null
  const { geometry, material, triangleBox } = getProxy()
  const boxOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.faceIndex == null ? -1 : triangleBox[e.faceIndex])

  return (
    <mesh
      geometry={geometry}
      material={material}
      onPointerMove={(e) => {
        if (!canHover) return
        e.stopPropagation()
        const box = boxOf(e)
        const state = useExperience.getState()
        state.setHoverBox(box)
        state.setHoverBlock(-1)
        document.body.style.cursor = box === state.selectedBox && state.phase === 'box' ? 'default' : 'pointer'
      }}
      onPointerOut={() => {
        useExperience.getState().setHoverBox(-1)
        document.body.style.cursor = ''
      }}
      onClick={(e) => {
        e.stopPropagation()
        const box = boxOf(e)
        if (box < 0) return
        const state = useExperience.getState()
        if (state.phase === 'box' && state.selectedBox === box) return
        state.selectBox(box)
      }}
    />
  )
}
