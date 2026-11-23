import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshBasicMaterial } from 'three'
import { getLayout } from '../../lib/layout'
import { useExperience } from '../../store/experience'

const canHover = window.matchMedia('(hover: hover)').matches

/**
 * Na vista de frente do bloco: um retângulo invisível por cadeira (de pé, na
 * altura de um degrau), só para saber qual cadeira está sob o cursor.
 */
function buildSeatProxy(blockIndex: number) {
  const { blocks, seats, tiers } = getLayout()
  const block = blocks[blockIndex]
  const tier = tiers.find((t) => t.spec.id === block.tier)!
  const positions: number[] = []
  const triangleSeat: number[] = []
  const half = 0.25
  for (let i = block.seatStart; i < block.seatStart + block.seatCount; i++) {
    const x = seats.position[i * 3]
    const y = seats.position[i * 3 + 1]
    const z = seats.position[i * 3 + 2]
    const yaw = seats.yaw[i]
    // eixo X local da cadeira (ao longo da fileira)
    const tx = Math.cos(yaw)
    const tz = -Math.sin(yaw)
    const rise = tier.rows[seats.row[i] - 1]?.rise ?? 0.5
    const y0 = y + 0.15
    const y1 = y0 + Math.max(rise, 0.45)
    const quad: [number, number, number][] = [
      [x - tx * half, y0, z - tz * half],
      [x + tx * half, y0, z + tz * half],
      [x + tx * half, y1, z + tz * half],
      [x - tx * half, y1, z - tz * half],
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
