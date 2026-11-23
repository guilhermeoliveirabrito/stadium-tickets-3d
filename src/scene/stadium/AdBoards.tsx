import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BoxGeometry, MeshLambertMaterial, PlaneGeometry } from 'three'
import { once } from '../../lib/once'
import { canvasTexture } from '../../lib/textures'
import { drawGithub, LED_FONT } from './ledContent'

const HEIGHT = 0.9
/** velocidade das placas rolando (m/s) */
const SPEED = 0.9

type Panel =
  | { kind: 'github'; width: number; bg: string; fg: string; host: string }
  | { kind: 'text'; width: number; bg: string; fg: string; text: string; weight: number; tracking: number }

// Larguras em metros. A maior parte das placas leva o GitHub do autor; as
// outras ficam com a final e o nome da arena.
const PANELS: Panel[] = [
  { kind: 'github', width: 11, bg: '#0d1117', fg: '#ffffff', host: '#9aa4b2' },
  { kind: 'text', width: 6.5, bg: '#1f4fd6', fg: '#ffffff', text: 'FINAL 2026', weight: 800, tracking: 0.16 },
  { kind: 'github', width: 11, bg: '#ff5a1f', fg: '#ffffff', host: '#ffe0d1' },
  { kind: 'text', width: 7.5, bg: '#0f1d4a', fg: '#ffffff', text: 'ARENA AURORA', weight: 700, tracking: 0.2 },
]

/** metros cobertos por uma repetição da textura */
const TEXTURE_LENGTH = PANELS.reduce((sum, p) => sum + p.width, 0)

function drawBoards(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const scale = w / TEXTURE_LENGTH
  let x = 0
  for (const p of PANELS) {
    const pw = p.width * scale
    ctx.fillStyle = p.bg
    ctx.fillRect(x, 0, pw, h)
    if (p.kind === 'github') {
      drawGithub(ctx, x + pw / 2, h / 2, h * 0.42, pw * 0.86, p.fg, p.host)
    } else {
      const size = h * 0.46
      ctx.fillStyle = p.fg
      ctx.font = `${p.weight} ${size}px ${LED_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.letterSpacing = `${p.tracking * size}px`
      ctx.fillText(p.text, x + pw / 2, h / 2 + size * 0.04)
    }
    x += pw
  }
}

const BOARDS = [
  { length: 100, position: [0, 0, -39.2] as const, rotation: 0 },
  { length: 100, position: [0, 0, 39.2] as const, rotation: Math.PI },
  { length: 52, position: [57.8, 0, 0] as const, rotation: -Math.PI / 2 },
  { length: 52, position: [-57.8, 0, 0] as const, rotation: Math.PI / 2 },
]

const getBoards = once(() => {
  const texture = canvasTexture(4096, 112, drawBoards, { repeat: true })
  const body = new MeshLambertMaterial({ color: '#16181c' })
  const boards = BOARDS.map((b, i) => {
    const map = texture.clone()
    map.repeat.set(b.length / TEXTURE_LENGTH, 1)
    map.offset.set(i * 0.37, 0)
    return {
      ...b,
      map,
      face: new MeshLambertMaterial({
        map,
        emissiveMap: map,
        emissive: '#ffffff',
        emissiveIntensity: 2.2,
      }),
      faceGeometry: new PlaneGeometry(b.length, HEIGHT),
      bodyGeometry: new BoxGeometry(b.length, HEIGHT, 0.14),
    }
  })
  return { texture, body, boards }
})

export function AdBoards() {
  const parts = useMemo(() => getBoards(), [])

  useEffect(() => {
    // redesenha quando a fonte terminar de carregar
    document.fonts?.ready.then(() => {
      const canvas = parts.texture.image as HTMLCanvasElement
      drawBoards(canvas.getContext('2d')!, canvas.width, canvas.height)
      parts.texture.needsUpdate = true
      parts.boards.forEach((b) => (b.map.needsUpdate = true))
    })
  }, [parts])

  // as placas rolam devagar, como as de LED em volta do gramado
  useFrame((_, delta) => {
    for (const b of getBoards().boards) b.map.offset.x = (b.map.offset.x + (delta * SPEED) / TEXTURE_LENGTH) % 1
  })

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
