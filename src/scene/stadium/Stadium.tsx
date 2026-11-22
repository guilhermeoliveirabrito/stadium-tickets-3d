import { Pitch } from './Pitch'
import { Stands } from './Stands'

export function Stadium() {
  return (
    <group>
      <Pitch />
      <Stands />
    </group>
  )
}
