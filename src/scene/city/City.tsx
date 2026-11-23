import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { getCity } from '../../lib/city/layout'
import { outside } from '../outside'
import { Buildings } from './Buildings'
import { Crowd } from './Crowd'
import { Ground } from './Ground'
import { LotGates } from './LotGates'
import { StreetLights } from './StreetLights'
import { Traffic } from './Traffic'
import { Trees } from './Trees'

export function City() {
  const city = useMemo(() => getCity(), [])
  const surroundings = useRef<Group>(null)
  // dentro do estádio o entorno nem é desenhado (o chão fica: é barato e,
  // coberto pela neblina, continua fazendo o horizonte)
  useFrame(() => {
    if (surroundings.current) surroundings.current.visible = outside.visible
  })
  return (
    <group>
      <Ground />
      <group ref={surroundings}>
        <Buildings buildings={city.buildings} />
        <StreetLights lamps={city.lamps} />
        <LotGates lot={city.lot} />
        <Trees trees={city.trees} />
        <Traffic />
        <Crowd />
      </group>
    </group>
  )
}
