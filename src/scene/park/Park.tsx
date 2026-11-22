import { useMemo } from 'react'
import { plantTrees } from '../../lib/park'
import { Ground } from './Ground'
import { Trees } from './Trees'

export function Park() {
  const trees = useMemo(() => plantTrees(), [])
  return (
    <group>
      <Ground />
      <Trees trees={trees} />
    </group>
  )
}
