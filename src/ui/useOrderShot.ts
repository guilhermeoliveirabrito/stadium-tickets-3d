import { type Order, orderPlace, povKey, useExperience } from '../store/experience'

/** Foto da vista do lugar de um ingresso: a guardada com ele ou a tirada nesta visita. */
export function useOrderShot(order: Order | null | undefined) {
  const povShots = useExperience((s) => s.povShots)
  if (!order) return null
  return order.shot ?? povShots[povKey(order.kind, orderPlace(order))] ?? null
}
