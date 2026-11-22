import { BOWL } from '../../config/stadium'
import { bowlDistance, LAKE, PARK_SIZE, PATHS, PLAZA_D, RING_ROAD_D } from '../../lib/park'
import { fbm } from '../../lib/random'

export const FAR_GROUND = '#5c7a37'

const HALF = PARK_SIZE / 2

function roundedRectPath(ctx: CanvasRenderingContext2D, d: number, toPx: (v: number) => number) {
  const hx = BOWL.halfX + d
  const hz = BOWL.halfZ + d
  const r = BOWL.radius + d
  ctx.beginPath()
  ctx.roundRect(toPx(-hx), toPx(-hz), toPx(hx) - toPx(-hx), toPx(hz) - toPx(-hz), (r / PARK_SIZE) * ctx.canvas.width)
}

function grassBase(size: number) {
  const n = 384
  const low = document.createElement('canvas')
  low.width = low.height = n
  const g = low.getContext('2d')!
  const img = g.createImageData(n, n)
  const light = [122, 150, 74]
  const dark = [82, 112, 54]
  const dry = [150, 152, 92]
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const wx = (x / n) * PARK_SIZE
      const wz = (y / n) * PARK_SIZE
      const a = fbm(wx * 0.008, wz * 0.008, 4, 21)
      const b = fbm(wx * 0.03 + 9, wz * 0.03 + 9, 3, 33)
      const t = Math.min(1, Math.max(0, (a - 0.3) * 1.8))
      const dryness = Math.max(0, (b - 0.62) * 2.2)
      const i = (y * n + x) * 4
      for (let c = 0; c < 3; c++) {
        const v = dark[c] + (light[c] - dark[c]) * t
        img.data[i + c] = v + (dry[c] - v) * dryness * 0.5
      }
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return { canvas: low, size }
}

export function drawGround(ctx: CanvasRenderingContext2D, size: number) {
  const S = size / PARK_SIZE
  const px = (v: number) => (v + HALF) * S

  const base = grassBase(size)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(base.canvas, 0, 0, size, size)

  // margem úmida do lago
  ctx.beginPath()
  LAKE.outline.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), px(z)) : ctx.moveTo(px(x), px(z))))
  ctx.closePath()
  ctx.fillStyle = '#8c8a5e'
  ctx.strokeStyle = '#9b9567'
  ctx.lineWidth = 7 * S
  ctx.lineJoin = 'round'
  ctx.fill()
  ctx.stroke()

  // praça
  roundedRectPath(ctx, PLAZA_D, px)
  ctx.fillStyle = '#d6d0c3'
  ctx.fill()
  ctx.save()
  roundedRectPath(ctx, PLAZA_D, px)
  ctx.clip()
  ctx.strokeStyle = 'rgba(150, 140, 122, 0.45)'
  ctx.lineWidth = Math.max(1, 0.25 * S)
  for (let d = 58; d < PLAZA_D; d += 4.5) {
    roundedRectPath(ctx, d, px)
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = '#bdb6a6'
  ctx.lineWidth = 1.2 * S
  roundedRectPath(ctx, PLAZA_D, px)
  ctx.stroke()

  // vias e caminhos
  const strokePath = (pts: [number, number][], closed: boolean) => {
    ctx.beginPath()
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), px(z)) : ctx.moveTo(px(x), px(z))))
    if (closed) ctx.closePath()
    ctx.stroke()
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const p of PATHS.filter((p) => p.kind === 'walk')) {
    ctx.strokeStyle = '#c2bba9'
    ctx.lineWidth = (p.width + 1.2) * S
    strokePath(p.points, !!p.closed)
    ctx.strokeStyle = '#e2ddd0'
    ctx.lineWidth = p.width * S
    strokePath(p.points, !!p.closed)
  }
  // Cada camada é desenhada para todas as vias antes da próxima (calçada,
  // asfalto, faixas). Assim o asfalto de uma via cobre a calçada da outra e
  // os cruzamentos ficam contínuos.
  const roads = PATHS.filter((p) => p.kind === 'road')
  ctx.strokeStyle = '#d9d4c6'
  for (const p of roads) {
    ctx.lineWidth = (p.width + 3) * S
    strokePath(p.points, !!p.closed)
  }
  ctx.strokeStyle = '#4b4f55'
  for (const p of roads) {
    ctx.lineWidth = p.width * S
    strokePath(p.points, !!p.closed)
  }
  ctx.strokeStyle = 'rgba(236, 232, 220, 0.85)'
  ctx.lineWidth = 0.25 * S
  ctx.setLineDash([5 * S, 6 * S])
  for (const p of roads) {
    // a faixa central das saídas só começa depois do cruzamento com o anel
    const points = p.closed ? p.points : p.points.filter(([x, z]) => Math.abs(bowlDistance(x, z) - RING_ROAD_D) > 14)
    strokePath(points, !!p.closed)
  }
  ctx.setLineDash([])

  // borda: funde com o chão distante
  const fade = 110 * S
  const edges: [number, number, number, number, number, number, number, number][] = [
    [0, 0, 0, fade, 0, 0, size, fade],
    [0, size, 0, size - fade, 0, size - fade, size, fade],
    [0, 0, fade, 0, 0, 0, fade, size],
    [size, 0, size - fade, 0, size - fade, 0, fade, size],
  ]
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, FAR_GROUND)
    grad.addColorStop(1, 'rgba(92, 122, 55, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(rx, ry, rw, rh)
  }
}
