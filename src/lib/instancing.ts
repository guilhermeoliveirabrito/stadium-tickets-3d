import { Matrix4, Vector3 } from 'three'
import type { Frame } from './bowl'

const UP = new Vector3(0, 1, 0)
const T = new Vector3()
const IN = new Vector3()

/**
 * Matriz com X ao longo da curva, Y para cima e Z apontando para o campo.
 */
export function frameMatrix(f: Frame, y: number, out = new Matrix4(), local?: Matrix4) {
  T.set(f.tx, 0, f.tz)
  IN.set(-f.nx, 0, -f.nz)
  out.makeBasis(T, UP, IN)
  out.setPosition(f.x, y, f.z)
  if (local) out.multiply(local)
  return out
}
