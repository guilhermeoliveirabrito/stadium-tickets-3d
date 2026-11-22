import { useMemo } from 'react'
import { Object3D } from 'three'
import { BOWL, ROOF } from '../../config/stadium'

const LAMP_Y = ROOF.innerY - ROOF.thickness - 0.6
const SX = BOWL.halfX - BOWL.radius
const SZ = BOWL.halfZ - BOWL.radius
const R = BOWL.radius + ROOF.inner

type V3 = [number, number, number]

// Oito refletores na borda interna da cobertura (meio de cada lado e cantos).
// Os feixes são estreitos e miram o campo: abertos demais, eles pegam a
// arquibancada logo abaixo da lâmpada e criam manchas. As arquibancadas
// recebem a borda dos feixes do lado oposto e a luz de preenchimento.
// Sem sombra: o alcance limitado evita que a luz vaze para fora do estádio.
const POSITIONS: [number, number][] = [
  [0, -(SZ + R)],
  [0, SZ + R],
  [SX + R, 0],
  [-(SX + R), 0],
  ...[
    [SX, -SZ, -Math.PI / 4],
    [SX, SZ, Math.PI / 4],
    [-SX, SZ, (3 * Math.PI) / 4],
    [-SX, -SZ, (-3 * Math.PI) / 4],
  ].map(([cx, cz, a]) => [cx + Math.cos(a) * R, cz + Math.sin(a) * R] as [number, number]),
]

const SPOTS: { position: V3; target: V3 }[] = POSITIONS.map(([x, z]) => ({
  position: [x, LAMP_Y, z],
  // mira um pouco além do centro para alcançar a arquibancada oposta
  target: [-x * 0.18, 0, -z * 0.18],
}))

export function Floodlights() {
  const targets = useMemo(
    () =>
      SPOTS.map((s) => {
        const target = new Object3D()
        target.position.set(...s.target)
        return target
      }),
    [],
  )

  return (
    <group>
      {SPOTS.map((s, i) => (
        <group key={i}>
          <primitive object={targets[i]} />
          <spotLight
            position={s.position}
            target={targets[i]}
            angle={0.42}
            penumbra={0.85}
            intensity={6200}
            distance={240}
            decay={2}
            color="#f2f5ff"
          />
        </group>
      ))}
      {/* luz de preenchimento para as arquibancadas */}
      <pointLight position={[0, 34, 0]} intensity={3400} distance={155} decay={2} color="#e6edff" />
    </group>
  )
}
