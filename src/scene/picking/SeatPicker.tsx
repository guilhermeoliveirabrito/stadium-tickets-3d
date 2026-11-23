import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshBasicMaterial } from 'three'
import { SEAT } from '../../config/stadium'
import { getLayout } from '../../lib/layout'
import { useExperience } from '../../store/experience'

const canHover = window.matchMedia('(hover: hover)').matches

// Alvo de cada cadeira, no espaço dela (z para o campo): uma rampa da beira
// do assento até o topo do encosto, da largura da célula inteira. Visto de
// frente, cobre exatamente o que aparece da cadeira, sem frestas entre vizinhas.
const PICK_BOTTOM = { y: 0.38, z: 0.26 }
const PICK_TOP = { y: 0.96, z: -0.31 }

/**
 * Na vista de frente do bloco: um retângulo invisível por cadeira, só para
 * saber qual cadeira está sob o cursor.
 */
function buildSeatProxy(blockIndex: number) {
  const { blocks, seats } = getLayout()
  const block = blocks[blockIndex]
  const positions: number[] = []
  const triangleSeat: number[] = []
  const half = SEAT.pitch / 2
  for (let i = block.seatStart; i < block.seatStart + block.seatCount; i++) {
    const x = seats.position[i * 3]
    const y = seats.position[i * 3 + 1]
    const z = seats.position[i * 3 + 2]
    const c = Math.cos(seats.yaw[i])
    const s = Math.sin(seats.yaw[i])
    // ponto local (lx, ly, lz) girado pelo yaw da cadeira
    const at = (lx: number, ly: number, lz: number) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c]
    const quad = [
      at(-half, PICK_BOTTOM.y, PICK_BOTTOM.z),
      at(half, PICK_BOTTOM.y, PICK_BOTTOM.z),
      at(half, PICK_TOP.y, PICK_TOP.z),
      at(-half, PICK_TOP.y, PICK_TOP.z),
    ]
    for (const k of [0, 1, 2, 0, 2, 3]) positions.push(...quad[k])
    triangleSeat.push(i, i)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()
  return { geometry, triangleSeat }
}

export function SeatPicker() {
  const phase = useExperience((s) => s.phase)
  const selectedBlock = useExperience((s) => s.selectedBlock)
  const active = phase === 'block' && selectedBlock >= 0

  const proxy = useMemo(() => (active ? buildSeatProxy(selectedBlock) : null), [active, selectedBlock])
  const material = useMemo(() => {
    const m = new MeshBasicMaterial({ side: DoubleSide })
    m.visible = false
    return m
  }, [])
  useEffect(() => () => proxy?.geometry.dispose(), [proxy])

  if (!proxy) return null
  const seatOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.faceIndex == null ? -1 : proxy.triangleSeat[e.faceIndex])
  const { seats } = getLayout()

  return (
    <mesh
      geometry={proxy.geometry}
      material={material}
      onPointerMove={(e) => {
        if (!canHover) return
        e.stopPropagation()
        const seat = seatOf(e)
        useExperience.getState().setHoverSeat(seat)
        document.body.style.cursor = seat >= 0 && !seats.taken[seat] ? 'pointer' : 'default'
      }}
      onPointerOut={() => {
        useExperience.getState().setHoverSeat(-1)
        document.body.style.cursor = ''
      }}
      onClick={(e) => {
        e.stopPropagation()
        const seat = seatOf(e)
        if (seat < 0) return
        const state = useExperience.getState()
        // no toque não existe "passar o mouse": o toque mostra a informação da cadeira
        if (!canHover) state.setHoverSeat(seat)
        if (seats.taken[seat]) return
        state.selectSeat(state.selectedSeat === seat ? -1 : seat)
      }}
    />
  )
}
