import { BOWL } from '../../config/stadium'
import type { Rect, Vec2 } from '../../lib/city/geometry'
import { type CityLayout, HALF, PLAZA_D, type Road, SIDEWALK, WORLD } from '../../lib/city/layout'
import { fbm } from '../../lib/random'

export const FAR_GROUND = '#0d100c'

type Ctx = CanvasRenderingContext2D
type Px = (v: number) => number

function mapper(size: number) {
  const S = size / WORLD
  return { S, px: (v: number) => (v + HALF) * S }
}

function roundedRectPath(ctx: Ctx, d: number, px: Px, S: number) {
  const hx = BOWL.halfX + d
  const hz = BOWL.halfZ + d
  ctx.beginPath()
  ctx.roundRect(px(-hx), px(-hz), 2 * hx * S, 2 * hz * S, (BOWL.radius + d) * S)
}

/** Esplanada: anel em volta do estádio somado ao pátio que leva ao estacionamento. */
function plazaPath(ctx: Ctx, forecourt: Rect, px: Px, S: number) {
  roundedRectPath(ctx, PLAZA_D, px, S)
  ctx.rect(px(forecourt.x0), px(forecourt.z0), (forecourt.x1 - forecourt.x0) * S, (forecourt.z1 - forecourt.z0) * S)
}

function polyPath(ctx: Ctx, pts: Vec2[], closed: boolean, px: Px) {
  ctx.beginPath()
  pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), px(z)) : ctx.moveTo(px(x), px(z))))
  if (closed) ctx.closePath()
}

/** Desloca a linha para o lado (positivo = normal à esquerda do sentido dos pontos). */
function offsetPolyline(pts: Vec2[], offset: number, closed: boolean): Vec2[] {
  const n = pts.length
  return pts.map((p, i) => {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]
    const dx = next[0] - prev[0]
    const dz = next[1] - prev[1]
    const len = Math.hypot(dx, dz) || 1
    return [p[0] - (dz / len) * offset, p[1] + (dx / len) * offset]
  })
}

function rotatedRect(ctx: Ctx, x: number, z: number, w: number, d: number, yaw: number, px: Px, S: number) {
  ctx.save()
  ctx.translate(px(x), px(z))
  ctx.rotate(-yaw)
  ctx.beginPath()
  ctx.rect((-w / 2) * S, (-d / 2) * S, w * S, d * S)
  ctx.restore()
}

function grassBase() {
  const n = 384
  const low = document.createElement('canvas')
  low.width = low.height = n
  const g = low.getContext('2d')!
  const img = g.createImageData(n, n)
  const light = [112, 136, 70]
  const dark = [74, 100, 52]
  const dry = [138, 138, 88]
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const wx = (x / n) * WORLD
      const wz = (y / n) * WORLD
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
  return low
}

const MARKINGS: Record<Road['kind'], { dashed: number[]; edge: number; center: 'median' | 'double' | 'dashed' }> = {
  avenue: { dashed: [-7.2, -3.6, 3.6, 7.2], edge: 10.5, center: 'median' },
  access: { dashed: [], edge: 4.5, center: 'double' },
  street: { dashed: [], edge: 0, center: 'dashed' },
}

export function drawGround(ctx: Ctx, size: number, city: CityLayout) {
  const { S, px } = mapper(size)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(grassBase(), 0, 0, size, size)
  ctx.lineJoin = 'round'

  // lago e caminho do parque
  polyPath(ctx, city.lake, true, px)
  ctx.fillStyle = '#7d7b57'
  ctx.strokeStyle = '#8a8560'
  ctx.lineWidth = 7 * S
  ctx.fill()
  ctx.stroke()
  for (const walk of city.walks) {
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#b9b2a2'
    ctx.lineWidth = (walk.width + 1) * S
    polyPath(ctx, walk.points, !!walk.closed, px)
    ctx.stroke()
    ctx.strokeStyle = '#d8d1c2'
    ctx.lineWidth = walk.width * S
    ctx.stroke()
  }

  // esplanada em pedra clara, com paginação em anéis e uma grade no pátio
  plazaPath(ctx, city.forecourt, px, S)
  ctx.fillStyle = '#d3ccbd'
  ctx.fill()
  ctx.save()
  plazaPath(ctx, city.forecourt, px, S)
  ctx.clip()
  ctx.strokeStyle = 'rgba(150, 138, 118, 0.45)'
  ctx.lineWidth = Math.max(1, 0.25 * S)
  for (let d = 58; d < PLAZA_D + 40; d += 5) {
    roundedRectPath(ctx, d, px, S)
    ctx.stroke()
  }
  const f = city.forecourt
  ctx.beginPath()
  for (let x = f.x0; x <= f.x1; x += 6) {
    ctx.moveTo(px(x), px(f.z0))
    ctx.lineTo(px(x), px(f.z1))
  }
  for (let z = f.z0; z <= f.z1; z += 6) {
    ctx.moveTo(px(f.x0), px(z))
    ctx.lineTo(px(f.x1), px(z))
  }
  ctx.stroke()
  ctx.restore()
  plazaPath(ctx, city.forecourt, px, S)
  ctx.strokeStyle = '#a9a193'
  ctx.lineWidth = 1 * S
  ctx.stroke()

  // estacionamento colado ao pátio
  const lot = city.lot
  ctx.fillStyle = '#383b40'
  ctx.fillRect(px(lot.x0), px(lot.z0), (lot.x1 - lot.x0) * S, (lot.z1 - lot.z0) * S)
  ctx.strokeStyle = '#8c8984'
  ctx.lineWidth = 1.2 * S
  ctx.strokeRect(px(lot.x0), px(lot.z0), (lot.x1 - lot.x0) * S, (lot.z1 - lot.z0) * S)
  ctx.strokeStyle = 'rgba(236, 236, 228, 0.42)'
  ctx.lineWidth = Math.max(1, 0.13 * S)
  ctx.beginPath()
  for (const s of lot.stalls) {
    for (const dz of [-1.3, 1.3]) {
      ctx.moveTo(px(s.x - 2.5), px(s.z + dz))
      ctx.lineTo(px(s.x + 2.5), px(s.z + dz))
    }
  }
  ctx.stroke()
  // passarelas de pedestres do estacionamento até o pátio
  ctx.fillStyle = 'rgba(214, 206, 190, 0.9)'
  for (let z = -90; z <= 90; z += 60) ctx.fillRect(px(lot.x1 - 30), px(z - 2), 30 * S, 4 * S)

  // entradas das casas e piscinas
  ctx.fillStyle = '#9c988f'
  for (const p of city.porches) {
    rotatedRect(ctx, p.x, p.z, p.w, p.d, p.yaw, px, S)
    ctx.fill()
  }
  for (const pool of city.pools) {
    rotatedRect(ctx, pool.x, pool.z, pool.w + 1.2, pool.d + 1.2, pool.yaw, px, S)
    ctx.fillStyle = '#d9dcd8'
    ctx.fill()
    rotatedRect(ctx, pool.x, pool.z, pool.w, pool.d, pool.yaw, px, S)
    ctx.fillStyle = '#2fa6cc'
    ctx.fill()
  }

  // Cada camada é desenhada para todas as vias antes da próxima (calçada,
  // asfalto, faixas), assim os cruzamentos ficam contínuos.
  const disk = (x: number, z: number, r: number, color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(px(x), px(z), r * S, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.lineCap = 'square'
  ctx.strokeStyle = '#8e8b85'
  for (const road of city.roads) {
    ctx.lineWidth = (road.width + SIDEWALK * 2) * S
    polyPath(ctx, road.points, !!road.closed, px)
    ctx.stroke()
  }
  for (const t of city.turnarounds) disk(t.x, t.z, t.r + SIDEWALK, '#8e8b85')
  ctx.strokeStyle = '#2f3237'
  for (const road of city.roads) {
    ctx.lineWidth = road.width * S
    polyPath(ctx, road.points, !!road.closed, px)
    ctx.stroke()
  }
  for (const t of city.turnarounds) disk(t.x, t.z, t.r, '#2f3237')

  ctx.lineCap = 'butt'
  const line = (pts: Vec2[], closed: boolean, color: string, width: number, dash: number[] = []) => {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, width * S)
    ctx.setLineDash(dash.map((v) => v * S))
    polyPath(ctx, pts, closed, px)
    ctx.stroke()
  }
  const white = 'rgba(235, 235, 228, 0.78)'
  const yellow = 'rgba(232, 182, 54, 0.85)'
  for (const road of city.roads) {
    const m = MARKINGS[road.kind]
    const closed = !!road.closed
    for (const off of m.dashed) line(offsetPolyline(road.points, off, closed), closed, white, 0.15, [3, 5])
    if (m.edge) for (const off of [-m.edge, m.edge]) line(offsetPolyline(road.points, off, closed), closed, white, 0.15)
    if (m.center === 'median') {
      line(road.points, closed, '#4c5148', 1.4)
      for (const off of [-0.85, 0.85]) line(offsetPolyline(road.points, off, closed), closed, yellow, 0.13)
    } else if (m.center === 'double') {
      for (const off of [-0.2, 0.2]) line(offsetPolyline(road.points, off, closed), closed, yellow, 0.13)
    } else {
      line(road.points, closed, 'rgba(232, 182, 54, 0.75)', 0.13, [2.5, 3.5])
    }
  }
  ctx.setLineDash([])
  // o retorno da rua sem saída fica sem faixa
  for (const t of city.turnarounds) disk(t.x, t.z, t.r, '#2f3237')

  // cruzamentos: apaga as faixas e desenha as faixas de pedestre
  for (const it of city.intersections) {
    ctx.fillStyle = '#2f3237'
    ctx.fillRect(px(it.x - it.hx), px(it.z - it.hz), it.hx * 2 * S, it.hz * 2 * S)
    if (!it.crosswalk) continue
    ctx.fillStyle = 'rgba(236, 236, 230, 0.8)'
    for (const sign of [1, -1]) {
      const zc = it.z + sign * (it.hz + 2)
      for (let k = -it.hx + 0.8; k < it.hx - 0.6; k += 1.25) ctx.fillRect(px(it.x + k), px(zc - 1.5), 0.6 * S, 3 * S)
      const xc = it.x + sign * (it.hx + 2)
      for (let k = -it.hz + 0.8; k < it.hz - 0.6; k += 1.25) ctx.fillRect(px(xc - 1.5), px(it.z + k), 3 * S, 0.6 * S)
    }
  }

  // borda: funde com o chão distante
  const fade = 90 * S
  const edges: [number, number, number, number, number, number, number, number][] = [
    [0, 0, 0, fade, 0, 0, size, fade],
    [0, size, 0, size - fade, 0, size - fade, size, fade],
    [0, 0, fade, 0, 0, 0, fade, size],
    [size, 0, size - fade, 0, size - fade, 0, fade, size],
  ]
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, FAR_GROUND)
    grad.addColorStop(1, 'rgba(13, 16, 12, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(rx, ry, rw, rh)
  }
}

// --------------------------------------------------------------------------
// mapa de luz: postes, casas, piscinas, esplanada e o neon refletido no chão

const NEON = ['#ff1438', '#d11aff', '#1f4dff', '#0dccff']

function spriteFactory() {
  const cache = new Map<string, HTMLCanvasElement>()
  return (color: string) => {
    let c = cache.get(color)
    if (!c) {
      c = document.createElement('canvas')
      c.width = c.height = 128
      const g = c.getContext('2d')!
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      grad.addColorStop(0, color)
      grad.addColorStop(0.22, color)
      grad.addColorStop(0.55, `${color}55`)
      grad.addColorStop(1, `${color}00`)
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
      cache.set(color, c)
    }
    return c
  }
}

export function drawLightMap(ctx: Ctx, size: number, city: CityLayout) {
  const { S, px } = mapper(size)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'lighter'
  const sprite = spriteFactory()
  const glow = (x: number, z: number, radius: number, color: string, alpha: number) => {
    ctx.globalAlpha = alpha
    const r = radius * S
    ctx.drawImage(sprite(color), px(x) - r, px(z) - r, r * 2, r * 2)
  }

  // esplanada clara, como nas arenas iluminadas à noite
  ctx.globalAlpha = 0.58
  ctx.fillStyle = '#ffd9a8'
  plazaPath(ctx, city.forecourt, px, S)
  ctx.fill()

  for (const lamp of city.lamps) {
    const reach = lamp.kind === 'street' ? 1.8 : 0
    const x = lamp.x + Math.sin(lamp.yaw) * reach
    const z = lamp.z + Math.cos(lamp.yaw) * reach
    if (lamp.kind === 'street') glow(x, z, 15, '#ffb066', 0.85)
    else if (lamp.kind === 'lot') glow(x, z, 24, '#e6eeff', 0.62)
    else if (lamp.kind === 'plaza') glow(x, z, 12, '#ffd19a', 0.32)
    else glow(x, z, 8, '#ffc98a', 0.7)
  }

  for (const b of city.buildings) {
    if (b.kind === 'tower') continue
    // as vilinhas têm luz de quintal acesa, para aparecerem na vista de cima
    if (b.village) glow(b.x, b.z, Math.max(b.w, b.d) * 1.15, '#ffa45c', 0.3)
    else glow(b.x, b.z, Math.max(b.w, b.d) * 0.85, '#ff9a4d', b.kind === 'house' ? 0.12 : 0.16)
    if (b.shops) {
      const fx = b.x - Math.sin(b.yaw) * (b.d / 2 + 3)
      const fz = b.z - Math.cos(b.yaw) * (b.d / 2 + 3)
      glow(fx, fz, b.w * 0.6, '#ffd7a8', 0.55)
    }
  }
  for (const p of city.porches) if (p.lit) glow(p.x, p.z, 5, '#ffaa55', 0.55)
  for (const pool of city.pools) glow(pool.x, pool.z, 6, '#3fd4ff', 0.75)

  // neon da fachada refletido na esplanada e luz quente do saguão
  const hx = BOWL.halfX - BOWL.radius
  const hz = BOWL.halfZ - BOWL.radius
  const r = BOWL.radius + 58
  const step = 3 / r
  const neonAt = (x: number, z: number) => {
    const t = ((Math.atan2(z, x) / (Math.PI * 2)) * 2 + 2) % 1
    return NEON[Math.floor(t * NEON.length) % NEON.length]
  }
  for (const [cx, cz, a0] of [
    [hx, -hz, -Math.PI / 2],
    [hx, hz, 0],
    [-hx, hz, Math.PI / 2],
    [-hx, -hz, Math.PI],
  ] as const) {
    for (let a = a0; a < a0 + Math.PI / 2; a += step) {
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      glow(x, z, 9, neonAt(x, z), 0.3)
      glow(cx + Math.cos(a) * (r - 3), cz + Math.sin(a) * (r - 3), 5, '#ffb27a', 0.18)
    }
  }
  for (const [x0, z0, x1, z1] of [
    [-hx, -hz - r, hx, -hz - r],
    [hx + r, -hz, hx + r, hz],
    [hx, hz + r, -hx, hz + r],
    [-hx - r, hz, -hx - r, -hz],
  ]) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    for (let t = 0; t <= len; t += 3) {
      const x = x0 + ((x1 - x0) * t) / len
      const z = z0 + ((z1 - z0) * t) / len
      glow(x, z, 9, neonAt(x, z), 0.3)
    }
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
