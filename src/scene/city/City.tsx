import { useMemo } from 'react'
import { getCity } from '../../lib/city/layout'
import { Buildings } from './Buildings'
import { Ground } from './Ground'
import { StreetLights } from './StreetLights'
import { Trees } from './Trees'

export function City() {
  const city = useMemo(() => getCity(), [])
  return (
    <group>
      <Ground city={city} />
      <Buildings buildings={city.buildings} />
      <StreetLights lamps={city.lamps} />
      <Trees trees={city.trees} />
    </group>
  )
}
