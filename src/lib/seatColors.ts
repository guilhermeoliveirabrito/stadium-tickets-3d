import { Color } from 'three'
import { SEAT_COLORS } from '../config/stadium'
import type { Seats } from './layout'
import { mulberry32 } from './random'

let cached: Float32Array | null = null

/** Cor (linear) de cada cadeira, com uma leve variação de tom como plástico desbotado pelo sol. */
export function getSeatColors(seats: Seats) {
  if (cached) return cached
  const out = new Float32Array(seats.count * 3)
  const taken = new Color(SEAT_COLORS.taken)
  const available = new Color(SEAT_COLORS.available)
  const color = new Color()
  const rand = mulberry32(42)
  for (let i = 0; i < seats.count; i++) {
    color.copy(seats.taken[i] ? taken : available).multiplyScalar(0.92 + rand() * 0.14)
    out.set([color.r, color.g, color.b], i * 3)
  }
  cached = out
  return out
}
