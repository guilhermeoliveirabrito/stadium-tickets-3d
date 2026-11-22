import { useMemo } from 'react'
import { BoxGeometry, Color, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import type { ParkingLot } from '../../lib/city/layout'
import { ACCESS_WIDTH } from '../../lib/city/layout'

/**
 * Portarias do estacionamento: uma cobertura iluminada sobre a via, com
 * cabine e cancelas levantadas. De cima elas aparecem como dois retângulos
 * acesos com a borda laranja da marca.
 */
export function LotGates({ lot }: { lot: ParkingLot }) {
  const parts = useMemo(() => {
    const width = ACCESS_WIDTH + 3
    return {
      gates: [
        { z: lot.nearZ + 5, flip: 1 },
        { z: lot.farZ - 5, flip: -1 },
      ],
      roof: new BoxGeometry(width, 0.5, 6),
      edge: new BoxGeometry(width + 0.3, 0.16, 0.16),
      side: new BoxGeometry(0.16, 0.16, 6.3),
      pillar: new BoxGeometry(0.35, 5, 0.35),
      booth: new BoxGeometry(2.2, 2.6, 2.6),
      boothGlass: new BoxGeometry(2.24, 1.1, 2.64),
      arm: new BoxGeometry(4.2, 0.12, 0.12),
      concrete: new MeshStandardMaterial({ color: '#3b3f46', roughness: 0.6, metalness: 0.3 }),
      light: new MeshBasicMaterial({ color: new Color('#f4f7ff').multiplyScalar(4) }),
      brand: new MeshBasicMaterial({ color: new Color('#ff5a1f').multiplyScalar(5) }),
      glass: new MeshBasicMaterial({ color: new Color('#ffd7a0').multiplyScalar(2.2) }),
      stripes: new MeshStandardMaterial({ color: '#e7e3dc', emissive: '#ff2a1a', emissiveIntensity: 0.6 }),
    }
  }, [lot])

  const x = lot.gate
  return (
    <group>
      {parts.gates.map(({ z, flip }) => (
        <group key={z} position={[x, 0, z]}>
          {/* cobertura com luz por baixo e contorno laranja */}
          <mesh geometry={parts.roof} material={parts.concrete} position-y={5.25} />
          <mesh geometry={parts.roof} material={parts.light} position-y={4.98} scale={[0.92, 0.06, 0.8]} />
          {[-3, 3].map((dz) => (
            <mesh key={dz} geometry={parts.edge} material={parts.brand} position={[0, 5.52, dz]} />
          ))}
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={parts.side} material={parts.brand} position={[sx * (ACCESS_WIDTH / 2 + 1.5), 5.52, 0]} />
          ))}
          {[-1, 1].flatMap((sx) =>
            [-2.6, 2.6].map((dz) => (
              <mesh
                key={`${sx}${dz}`}
                geometry={parts.pillar}
                material={parts.concrete}
                position={[sx * (ACCESS_WIDTH / 2 + 1.2), 2.5, dz]}
              />
            )),
          )}
          {/* cabine e cancelas levantadas */}
          <group position={[ACCESS_WIDTH / 2 + 2.6, 0, flip * 0.5]}>
            <mesh geometry={parts.booth} material={parts.concrete} position-y={1.3} />
            <mesh geometry={parts.boothGlass} material={parts.glass} position-y={1.75} />
          </group>
          {[-1, 1].map((lane) => (
            <mesh
              key={lane}
              geometry={parts.arm}
              material={parts.stripes}
              position={[lane * 2.6, 2.6, lane * 2.2]}
              rotation-z={lane * 1.1}
            />
          ))}
        </group>
      ))}
    </group>
  )
}
