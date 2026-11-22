import { useFrame } from '@react-three/fiber'
import { AdBoards } from './AdBoards'
import { Facade } from './Facade'
import { Fireworks } from './Fireworks'
import { Floodlights } from './Floodlights'
import { Pitch } from './Pitch'
import { Roof } from './Roof'
import { Seats } from './Seats'
import { Skyboxes } from './Skyboxes'
import { Stands } from './Stands'
import { neonTime } from './neon'

function NeonClock() {
  useFrame((_, delta) => {
    neonTime.value += delta
  })
  return null
}

export function Stadium() {
  return (
    <group>
      <Pitch />
      <AdBoards />
      <Stands />
      <Seats />
      <Skyboxes />
      <Roof />
      <Facade />
      <Floodlights />
      <NeonClock />
      <Fireworks />
    </group>
  )
}
