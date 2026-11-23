import { EVENT } from '../../config/event'
import { canvasTexture } from '../../lib/textures'
import { mulberry32 } from '../../lib/random'
import { LED_FONT } from './ledContent'

const WALL_W = 1024
const WALL_H = 456

// partes da parede do fundo, em fração da largura e da altura (de cima para baixo)
const SHELF = { x0: 0.31, x1: 0.69, y0: 0.2, y1: 0.66 }
const TVS = [
  { x0: 0.07, x1: 0.25, y0: 0.24, y1: 0.5 },
  { x0: 0.75, x1: 0.93, y0: 0.24, y1: 0.5 },
]

/** Ripado de madeira escura, com o nicho da adega e as molduras das TVs. */
function drawWall(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = mulberry32(7)
  ctx.fillStyle = '#2c1b12'
  ctx.fillRect(0, 0, w, h)
  const slat = 14
  for (let x = 0; x < w; x += slat) {
    const tone = 34 + rand() * 18
    ctx.fillStyle = `rgb(${tone + 22}, ${tone}, ${tone * 0.6})`
    ctx.fillRect(x + 1, 0, slat - 3, h)
  }
  // nicho e molduras escuras
  ctx.fillStyle = '#120c09'
  ctx.fillRect(SHELF.x0 * w - 6, SHELF.y0 * h - 6, (SHELF.x1 - SHELF.x0) * w + 12, (SHELF.y1 - SHELF.y0) * h + 12)
  ctx.fillStyle = '#0b0b0d'
  for (const tv of TVS) ctx.fillRect(tv.x0 * w - 5, tv.y0 * h - 5, (tv.x1 - tv.x0) * w + 10, (tv.y1 - tv.y0) * h + 10)
}

/** Partes que brilham: prateleiras iluminadas com garrafas, TVs com a partida e a sanca no teto. */
function drawGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = mulberry32(11)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  // sanca de luz no alto da parede
  const cove = ctx.createLinearGradient(0, 0, 0, h * 0.09)
  cove.addColorStop(0, 'rgba(255, 190, 120, 0.85)')
  cove.addColorStop(1, 'rgba(255, 190, 120, 0)')
  ctx.fillStyle = cove
  ctx.fillRect(0, 0, w, h * 0.09)

  // adega: fundo iluminado em degradê e garrafas em silhueta
  const x0 = SHELF.x0 * w
  const x1 = SHELF.x1 * w
  const y0 = SHELF.y0 * h
  const y1 = SHELF.y1 * h
  const back = ctx.createLinearGradient(0, y0, 0, y1)
  back.addColorStop(0, '#ffb066')
  back.addColorStop(1, '#a8521c')
  ctx.fillStyle = back
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  const shelves = 3
  for (let s = 0; s < shelves; s++) {
    const base = y0 + ((s + 1) * (y1 - y0)) / shelves
    ctx.fillStyle = '#2a170c'
    ctx.fillRect(x0, base - 4, x1 - x0, 4)
    for (let x = x0 + 8; x < x1 - 14; x += 12 + rand() * 10) {
      const bh = 26 + rand() * 18
      const bw = 7 + rand() * 4
      ctx.fillStyle = rand() < 0.5 ? 'rgba(30, 14, 6, 0.92)' : 'rgba(70, 28, 10, 0.85)'
      ctx.fillRect(x, base - 4 - bh * 0.62, bw, bh * 0.62)
      ctx.fillRect(x + bw * 0.32, base - 4 - bh, bw * 0.36, bh * 0.4)
    }
  }

  // TVs: o campo visto de cima e o placar
  for (const tv of TVS) {
    const tx = tv.x0 * w
    const ty = tv.y0 * h
    const tw = (tv.x1 - tv.x0) * w
    const th = (tv.y1 - tv.y0) * h
    const grass = ctx.createLinearGradient(tx, 0, tx + tw, 0)
    grass.addColorStop(0, '#1e7a34')
    grass.addColorStop(1, '#2c9a44')
    ctx.fillStyle = grass
    ctx.fillRect(tx, ty, tw, th)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.lineWidth = 2
    ctx.strokeRect(tx + tw * 0.08, ty + th * 0.14, tw * 0.84, th * 0.72)
    ctx.beginPath()
    ctx.moveTo(tx + tw / 2, ty + th * 0.14)
    ctx.lineTo(tx + tw / 2, ty + th * 0.86)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(tx + tw / 2, ty + th / 2, th * 0.14, 0, Math.PI * 2)
    ctx.stroke()
    // placar
    ctx.fillStyle = 'rgba(8, 10, 16, 0.9)'
    ctx.fillRect(tx + tw * 0.06, ty + th * 0.04, tw * 0.5, th * 0.18)
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${th * 0.12}px ${LED_FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${EVENT.home.short} 0 × 0 ${EVENT.away.short}`, tx + tw * 0.09, ty + th * 0.135)
  }
}

export function createSkyboxWallTextures() {
  const map = canvasTexture(WALL_W, WALL_H, drawWall)
  const glow = canvasTexture(WALL_W, WALL_H, drawGlow)
  return { map, glow, redraw: () => {
    const canvas = glow.image as HTMLCanvasElement
    drawGlow(canvas.getContext('2d')!, canvas.width, canvas.height)
    glow.needsUpdate = true
  } }
}

export const NUMBER_COLUMNS = 4
export const NUMBER_ROWS = 6

/** Placas "CAMAROTE 01" a "24" num atlas de 4 x 6 (lido por instância no shader). */
export function createSkyboxNumbers() {
  const tileW = 512
  const tileH = 96
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h)
    for (let i = 0; i < NUMBER_COLUMNS * NUMBER_ROWS; i++) {
      const x = (i % NUMBER_COLUMNS) * tileW
      const y = Math.floor(i / NUMBER_COLUMNS) * tileH
      ctx.fillStyle = '#0d0907'
      ctx.fillRect(x, y, tileW, tileH)
      ctx.fillStyle = '#e9c48c'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.letterSpacing = '10px'
      ctx.font = `600 34px ${LED_FONT}`
      ctx.fillText(`CAMAROTE ${String(i + 1).padStart(2, '0')}`, x + tileW / 2 + 5, y + tileH / 2 + 2)
      ctx.fillRect(x + tileW * 0.2, y + tileH - 14, tileW * 0.6, 2)
    }
  }
  const texture = canvasTexture(tileW * NUMBER_COLUMNS, tileH * NUMBER_ROWS, draw)
  return {
    texture,
    redraw: () => {
      const canvas = texture.image as HTMLCanvasElement
      draw(canvas.getContext('2d')!, canvas.width, canvas.height)
      texture.needsUpdate = true
    },
  }
}
