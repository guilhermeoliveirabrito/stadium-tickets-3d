import { BufferGeometry, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

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

// Perfil da concha da cadeira (lado de quem senta), em (z, y), da dobra da
// frente do assento até o topo do encosto. z aponta para o campo.
const SHELL_PROFILE: [number, number][] = [
  [0.218, 0.418],
  [0.228, 0.448],
  [0.198, 0.468],
  [0.04, 0.46],
  [-0.15, 0.452],
  [-0.2, 0.488],
  [-0.222, 0.6],
  [-0.244, 0.74],
  [-0.264, 0.86],
  [-0.258, 0.892],
]
/** a partir deste ponto do perfil a concha é encosto (curva para os lados) */
const BACKREST_FROM = 5
const SHELL_THICKNESS = 0.022
const ACROSS = 4

/** meia largura ao longo do perfil: o topo do encosto é um pouco mais estreito */
function halfWidth(t: number) {
  if (t >= SHELL_PROFILE.length - 2) return 0.196
  if (t === 0) return 0.205
  return 0.214
}

/**
 * Cadeira de perto: concha moldada (assento com as laterais levantadas e
 * encosto curvo, inclinado para trás), com espessura e um pé de metal.
 * Cerca de 200 triângulos; só os blocos perto da câmera usam esta versão.
 * O atributo aTint é 1 na concha (que leva a cor da cadeira) e 0 no metal.
 */
export function createDetailedSeatGeometry(): BufferGeometry {
  const rows = SHELL_PROFILE.length
  const cols = ACROSS + 1
  // normal do perfil para o lado de quem senta: (dy, -dz)
  const normals2d = SHELL_PROFILE.map((_, i) => {
    const a = SHELL_PROFILE[Math.max(0, i - 1)]
    const b = SHELL_PROFILE[Math.min(rows - 1, i + 1)]
    const dz = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dz, dy)
    return [dy / len, -dz / len] as const
  })
  const point = (t: number, k: number, back: boolean): [number, number, number] => {
    const u = (k / ACROSS) * 2 - 1
    let [z, y] = SHELL_PROFILE[t]
    if (t >= BACKREST_FROM) z += 0.03 * u * u
    else y += 0.014 * u * u
    if (back) {
      z -= normals2d[t][0] * SHELL_THICKNESS
      y -= normals2d[t][1] * SHELL_THICKNESS
    }
    return [u * halfWidth(t), y, z]
  }

  const pieces: BufferGeometry[] = []
  const piece = (positions: number[], indices: number[], tint: number) => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(positions, 3))
    g.setAttribute('aTint', new Float32BufferAttribute(new Array(positions.length / 3).fill(tint), 1))
    g.setIndex(indices)
    g.computeVertexNormals()
    pieces.push(g)
  }
  // grade (linhas x colunas); o triângulo da linha `refRow` deve ficar virado para `facing`
  const grid = (
    at: (r: number, c: number) => [number, number, number],
    nr: number,
    nc: number,
    facing: [number, number, number],
    refRow = 0,
  ) => {
    const positions: number[] = []
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) positions.push(...at(r, c))
    const indices: number[] = []
    for (let r = 0; r < nr - 1; r++) {
      for (let c = 0; c < nc - 1; c++) {
        const a = r * nc + c
        indices.push(a, a + nc, a + 1, a + 1, a + nc, a + nc + 1)
      }
    }
    // confere o sentido de um triângulo de referência e inverte tudo se a face estiver ao contrário
    const p = (i: number) => positions.slice(i * 3, i * 3 + 3)
    const ref = refRow * (nc - 1) * 6
    const [a, b, c] = [p(indices[ref]), p(indices[ref + 1]), p(indices[ref + 2])]
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]
    if (n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2] < 0) {
      for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
    }
    piece(positions, indices, 1)
  }

  // frente da concha e costas (conferidas no meio do assento), laterais,
  // dobra da frente (virada para baixo e para trás) e borda de cima
  grid((r, c) => point(r, c, false), rows, cols, [0, 1, 0], 3)
  grid((r, c) => point(r, c, true), rows, cols, [0, -1, 0], 3)
  grid((r, c) => point(r, 0, c === 1), rows, 2, [-1, 0, 0], 3)
  grid((r, c) => point(r, ACROSS, c === 1), rows, 2, [1, 0, 0], 3)
  grid((r, c) => point(0, c, r === 1), 2, cols, [0, -0.95, -0.32])
  grid((r, c) => point(rows - 1, c, r === 1), 2, cols, [0, 0.98, 0.18])

  // pé de metal sob o assento (só as quatro faces laterais)
  const leg: number[] = []
  const legIndex: number[] = []
  const x0 = -0.03
  const x1 = 0.03
  const z0 = -0.1
  const z1 = -0.02
  const top = 0.45
  const faces: [number, number, number][][] = [
    [[x0, 0, z1], [x1, 0, z1], [x1, top, z1], [x0, top, z1]],
    [[x1, 0, z0], [x0, 0, z0], [x0, top, z0], [x1, top, z0]],
    [[x0, 0, z0], [x0, 0, z1], [x0, top, z1], [x0, top, z0]],
    [[x1, 0, z1], [x1, 0, z0], [x1, top, z0], [x1, top, z1]],
  ]
  for (const f of faces) {
    const base = leg.length / 3
    for (const [x, y, z] of f) leg.push(x, y, z)
    legIndex.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  piece(leg, legIndex, 0)

  const merged = mergeGeometries(pieces)!
  pieces.forEach((g) => g.dispose())
  return merged
}
