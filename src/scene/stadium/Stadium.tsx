import { useFrame } from '@react-three/fiber'
import { QUALITY, type Tier } from '../../config/quality'
import { AdBoards } from './AdBoards'
import { Dugouts } from './Dugouts'
import { Facade } from './Facade'
import { Fireworks } from './Fireworks'
import { LedRibbons } from './LedRibbons'
import { Pitch } from './Pitch'
import { Players } from './Players'
import { Roof } from './Roof'
import { Screens } from './Screens'
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

export function Stadium({ tier }: { tier: Tier }) {
  return (
    <group>
      <Pitch />
      <Players />
      <Dugouts />
      <AdBoards />
      <Stands />
      <LedRibbons />
      <Seats detailBudget={QUALITY[tier].detailSeats} />
      <Skyboxes />
      <Roof />
      <Screens />
      <Facade />
      <NeonClock />
      <Fireworks />
    </group>
  )
}
