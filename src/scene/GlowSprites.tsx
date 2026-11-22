import { forwardRef, useMemo } from 'react'
import { Color, Points } from 'three'
import { createGlowGeometry, createGlowMaterial } from './glowMaterial'

interface Props {
  /** [x, y, z] de cada luz */
  points: [number, number, number][]
  color: string
  /** diâmetro do brilho em metros */
  size: number
  intensity: number
  minPx?: number
}

/** Brilho de lâmpadas pequenas, estável a qualquer distância. */
export const GlowSprites = forwardRef<Points, Props>(function GlowSprites(
  { points, color, size, intensity, minPx = 2.5 },
  ref,
) {
  const { geometry, material } = useMemo(() => {
    const c = new Color(color)
    const positions = new Float32Array(points.length * 3)
    const colors = new Float32Array(points.length * 3)
    points.forEach((p, i) => {
      positions.set(p, i * 3)
      colors.set([c.r, c.g, c.b], i * 3)
    })
    const geometry = createGlowGeometry(positions, colors)
    geometry.computeBoundingSphere()
    return { geometry, material: createGlowMaterial(size, intensity, minPx) }
  }, [points, color, size, intensity, minPx])

  return <points ref={ref} geometry={geometry} material={material} renderOrder={2} />
})
