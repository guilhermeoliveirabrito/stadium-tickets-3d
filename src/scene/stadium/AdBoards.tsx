import { useEffect, useMemo } from 'react'
import { BoxGeometry, MeshStandardMaterial, PlaneGeometry } from 'three'
import { canvasTexture } from '../../lib/textures'

const HEIGHT = 0.9
const TEXTURE_LENGTH = 28.8 // metros cobertos por uma repetição da textura

const PANELS = [
  { bg: '#ff5a1f', fg: '#ffffff', text: 'tribuna', weight: 800, size: 40, tracking: 0 },
  { bg: '#0f1d4a', fg: '#ffffff', text: 'ARENA AURORA', weight: 700, size: 28, tracking: 6 },
  { bg: '#f5f5f2', fg: '#c8102e', text: 'AURORA FC', weight: 800, size: 32, tracking: 2 },
  { bg: '#1f4fd6', fg: '#ffffff', text: 'FINAL 2026', weight: 800, size: 30, tracking: 4 },
]

function drawBoards(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pw = w / PANELS.length
  PANELS.forEach((p, i) => {
    const x = i * pw
    ctx.fillStyle = p.bg
    ctx.fillRect(x, 0, pw, h)
    ctx.fillStyle = p.fg
    ctx.font = `${p.weight} ${p.size}px "Inter Variable", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = `${p.tracking}px`
    ctx.fillText(p.text, x + pw / 2, h / 2 + 2)
  })
}

const BOARDS = [
  { length: 100, position: [0, 0, -39.2] as const, rotation: 0 },
  { length: 100, position: [0, 0, 39.2] as const, rotation: Math.PI },
  { length: 52, position: [57.8, 0, 0] as const, rotation: -Math.PI / 2 },
  { length: 52, position: [-57.8, 0, 0] as const, rotation: Math.PI / 2 },
]

export function AdBoards() {
  const parts = useMemo(() => {
    const texture = canvasTexture(2048, 64, drawBoards, { repeat: true })
    const body = new MeshStandardMaterial({ color: '#16181c', roughness: 0.6 })
    const boards = BOARDS.map((b, i) => {
      const map = texture.clone()
      map.repeat.set(b.length / TEXTURE_LENGTH, 1)
      map.offset.set(i * 0.37, 0)
      return {
        ...b,
        map,
        face: new MeshStandardMaterial({
          map,
          emissiveMap: map,
          emissive: '#ffffff',
          emissiveIntensity: 2.2,
          roughness: 0.35,
        }),
        faceGeometry: new PlaneGeometry(b.length, HEIGHT),
        bodyGeometry: new BoxGeometry(b.length, HEIGHT, 0.14),
      }
    })
    return { texture, body, boards }
  }, [])

  useEffect(() => {
    // redesenha quando a fonte terminar de carregar
    document.fonts?.ready.then(() => {
      const canvas = parts.texture.image as HTMLCanvasElement
      drawBoards(canvas.getContext('2d')!, canvas.width, canvas.height)
      parts.texture.needsUpdate = true
      parts.boards.forEach((b) => (b.map.needsUpdate = true))
    })
  }, [parts])

  return (
    <group>
      {parts.boards.map((b, i) => (
        <group key={i} position={b.position} rotation-y={b.rotation}>
          <mesh position={[0, HEIGHT / 2, -0.08]} geometry={b.bodyGeometry} material={parts.body} castShadow receiveShadow />
          <mesh position={[0, HEIGHT / 2, 0]} geometry={b.faceGeometry} material={b.face} />
        </group>
      ))}
    </group>
  )
}
