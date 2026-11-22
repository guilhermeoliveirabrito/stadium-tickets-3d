import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { TreeSpec } from '../../lib/park'
import { mulberry32, valueNoise } from '../../lib/random'

function lumpy(geometry: BufferGeometry, seed: number, amount = 0.2) {
  const g = mergeVertices(geometry.deleteAttribute('normal').deleteAttribute('uv'))
  const pos = g.attributes.position as BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const n = valueNoise(x * 2.1 + seed, z * 2.1 + y * 1.7, seed) - 0.5
    const s = 1 + n * amount * 2
    pos.setXYZ(i, x * s, y * s, z * s)
  }
  return g
}

/** Sombreamento embutido: base da copa mais escura e manchas de folhagem. */
function shadeByHeight(g: BufferGeometry, low = 0.42, high = 1.06) {
  g.computeBoundingBox()
  const { min, max } = g.boundingBox!
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / (max.y - min.y || 1)
    const speckle = 0.82 + valueNoise(pos.getX(i) * 5.3, pos.getZ(i) * 5.3 + pos.getY(i) * 3.1, 77) * 0.3
    const v = (low + (high - low) * Math.pow(t, 0.75)) * speckle
    colors.set([v, v * 1.02, v * 0.96], i * 3)
  }
  g.setAttribute('color', new BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

function canopyVariants() {
  const broad = shadeByHeight(lumpy(new IcosahedronGeometry(1, 1), 3, 0.26))
  const pine = shadeByHeight(lumpy(new ConeGeometry(0.85, 2.6, 9, 3).translate(0, 0.3, 0), 7, 0.1), 0.45, 1.0)
  const cluster = shadeByHeight(
    mergeGeometries([
      lumpy(new IcosahedronGeometry(0.78, 1), 11, 0.2).translate(-0.34, -0.04, 0.1),
      lumpy(new IcosahedronGeometry(0.7, 1), 13, 0.2).translate(0.4, 0.08, -0.12),
    ])!,
  )
  return [broad, pine, cluster]
}

const PALETTE = ['#25421d', '#2f5225', '#3a5f2a', '#476c30', '#55783a', '#2c4b26']
const BLOSSOM = ['#d6b03c', '#c99a35', '#a8669f']

function TreeVariant({ trees, geometry, material }: { trees: TreeSpec[]; geometry: BufferGeometry; material: MeshStandardMaterial }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const dummy = new Object3D()
    const color = new Color()
    const rand = mulberry32(Math.round(trees[0].x * 13 + trees[0].z * 7) + trees.length)
    const palette = PALETTE.map((c) => new Color(c))
    const blossom = BLOSSOM.map((c) => new Color(c))
    trees.forEach((t, i) => {
      const pine = t.variant === 1
      const trunk = t.height - t.radius * (pine ? 2.2 : 1.6)
      dummy.position.set(t.x, trunk + t.radius * (pine ? 1.0 : 0.82), t.z)
      dummy.rotation.set(0, rand() * Math.PI * 2, 0)
      dummy.scale.set(t.radius, t.radius * (pine ? 1.1 : 0.86), t.radius)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (!pine && rand() < 0.012) {
        color.copy(blossom[Math.floor(rand() * blossom.length)])
      } else {
        const k = Math.min(palette.length - 1, Math.floor(t.tint * palette.length))
        color.copy(palette[k]).lerp(palette[(k + 1) % palette.length], rand() * 0.5)
      }
      color.multiplyScalar(0.9 + rand() * 0.2)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees])

  return <instancedMesh ref={ref} args={[geometry, material, trees.length]} receiveShadow />
}

function Trunks({ trees }: { trees: TreeSpec[] }) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new CylinderGeometry(0.12, 0.2, 1, 6, 1, true).translate(0, 0.5, 0), [])
  const material = useMemo(() => new MeshStandardMaterial({ color: '#4f3d2c', roughness: 1 }), [])
  useLayoutEffect(() => {
    const mesh = ref.current!
    const dummy = new Object3D()
    trees.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z)
      dummy.scale.set(t.radius * 0.9, t.height - t.radius * 1.2, t.radius * 0.9)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees])
  return <instancedMesh ref={ref} args={[geometry, material, trees.length]} />
}

const CHUNK = 350

/** Divide as árvores em blocos para o frustum culling descartar o que está fora da tela. */
function chunked(trees: TreeSpec[]) {
  const map = new Map<string, TreeSpec[]>()
  for (const t of trees) {
    const key = `${Math.floor(t.x / CHUNK)},${Math.floor(t.z / CHUNK)}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return [...map.values()]
}

export function Trees({ trees }: { trees: TreeSpec[] }) {
  const { variants, material, chunks } = useMemo(() => {
    const variants = canopyVariants()
    const chunks = chunked(trees).map((list) => ({
      all: list,
      byVariant: variants.map((_, v) => list.filter((t) => t.variant === v)),
    }))
    return {
      variants,
      chunks,
      material: new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    }
  }, [trees])

  return (
    <group>
      {chunks.map((chunk, c) => (
        <group key={c}>
          {variants.map((geometry, v) =>
            chunk.byVariant[v].length ? (
              <TreeVariant key={v} trees={chunk.byVariant[v]} geometry={geometry} material={material} />
            ) : null,
          )}
          <Trunks trees={chunk.all} />
        </group>
      ))}
    </group>
  )
}
