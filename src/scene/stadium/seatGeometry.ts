import { BufferGeometry, Float32BufferAttribute } from 'three'

/**
 * Cadeira para a visão geral: só o assento e o encosto, quatro triângulos
 * desenhados dos dois lados. São 60 mil cadeiras, então cada triângulo conta.
 */
export function createSeatGeometry(): BufferGeometry {
  const w = 0.22
  // assento (y = 0,47) e encosto levemente inclinado para trás
  const positions = [
    -w, 0.47, -0.2, w, 0.47, -0.2, w, 0.47, 0.22, -w, 0.47, 0.22,
    -w, 0.46, -0.2, w, 0.46, -0.2, w, 0.9, -0.28, -w, 0.9, -0.28,
  ]
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setIndex([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7])
  g.computeVertexNormals()
  return g
}
