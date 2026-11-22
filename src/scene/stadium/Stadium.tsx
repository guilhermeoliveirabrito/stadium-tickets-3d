import { AdBoards } from './AdBoards'
import { Facade } from './Facade'
import { Floodlights } from './Floodlights'
import { Pitch } from './Pitch'
import { Roof } from './Roof'
import { Seats } from './Seats'
import { Skyboxes } from './Skyboxes'
import { Stands } from './Stands'

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
    </group>
  )
}
