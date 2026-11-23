import { Blimp } from './Blimp'
import { Helicopter } from './Helicopter'

/** O que voa em volta do estádio: o dirigível de propaganda e o helicóptero com holofote. */
export function Aircraft() {
  return (
    <group>
      <Blimp />
      <Helicopter />
    </group>
  )
}
