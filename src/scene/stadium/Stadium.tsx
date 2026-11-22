import { Pitch } from './Pitch'
import { Seats } from './Seats'
import { Stands } from './Stands'

export function Stadium() {
  return (
    <group>
      <Pitch />
      <Stands />
      <Seats />
    </group>
  )
}
