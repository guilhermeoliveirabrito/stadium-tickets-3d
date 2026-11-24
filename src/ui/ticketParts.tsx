import { useMemo } from 'react'
import { BOWL, PITCH, SKYBOX } from '../config/stadium'
import { frameAt, SEGMENTS } from '../lib/bowl'
import { getLayout } from '../lib/layout'
import { mulberry32 } from '../lib/random'
import { getSkyboxes, SKYBOX_HALF_SPAN } from '../lib/skyboxes'
import type { OrderItem } from '../store/experience'

/** Caminho SVG da curva paralela ao contorno do campo, a uma distância d. */
function contour(d: number) {
  const hx = BOWL.halfX + d
  const hz = BOWL.halfZ + d
  const r = BOWL.radius + d
  return `M${-hx + r},${-hz} H${hx - r} A${r},${r} 0 0 1 ${hx},${-hz + r} V${hz - r} A${r},${r} 0 0 1 ${hx - r},${hz} H${-hx + r} A${r},${r} 0 0 1 ${-hx},${hz - r} V${-hz + r} A${r},${r} 0 0 1 ${-hx + r},${-hz} Z`
}

/** Contorno do bloco (da primeira fileira até o fundo do anel), visto de cima. */
function blockOutline(blockIndex: number) {
  const { blocks, tiers } = getLayout()
  const block = blocks[blockIndex]
  const tier = tiers.find((t) => t.spec.id === block.tier)!
  const seg = SEGMENTS[block.segment]
  const steps = seg.kind === 'arc' ? 8 : 1
  const front: string[] = []
  const back: string[] = []
  for (let k = 0; k <= steps; k++) {
    const s = block.s0 + ((block.s1 - block.s0) * k) / steps
    const f = frameAt(seg, s, tier.rows[0].d)
    const b = frameAt(seg, s, tier.back)
    front.push(`${f.x.toFixed(1)},${f.z.toFixed(1)}`)
    back.unshift(`${b.x.toFixed(1)},${b.z.toFixed(1)}`)
  }
  return `M${[...front, ...back].join(' L')} Z`
}

/**
 * Mapa do estádio visto de cima (norte em cima) com o lugar comprado: o bloco
 * aceso e a cadeira marcada, ou o camarote.
 */
export function StadiumMap({ item }: { item: OrderItem }) {
  const marker = useMemo(() => {
    if (item.kind === 'seat') {
      const { seats } = getLayout()
      return { x: seats.position[item.seat * 3], z: seats.position[item.seat * 3 + 2], block: blockOutline(item.block) }
    }
    const box = getSkyboxes()[item.box]
    // a faixa de camarotes fica na frente do anel intermediário, nas laterais norte e sul
    const z = Math.sign(box.position[2]) * (BOWL.halfZ + (SKYBOX.front + SKYBOX.back) / 2)
    const half = SKYBOX.width / 2
    const x = box.position[0]
    const y0 = Math.sign(z) * (BOWL.halfZ + SKYBOX.front)
    const y1 = Math.sign(z) * (BOWL.halfZ + SKYBOX.back)
    return { x, z, block: `M${x - half},${y0} L${x + half},${y0} L${x + half},${y1} L${x - half},${y1} Z` }
  }, [item])
  const { halfLength: hl, halfWidth: hw } = PITCH

  return (
    <svg className="stadium-map" viewBox="-128 -108 256 216" role="img" aria-label="Mapa do estádio com o seu lugar">
      <path d={contour(57.5)} className="stadium-map__roof" />
      <path d={contour(52)} className="stadium-map__stands" />
      <path d={contour(30.5)} className="stadium-map__ring" />
      <path d={contour(20.4)} className="stadium-map__ring" />
      <path d={contour(0)} className="stadium-map__lower" />
      <rect x={-hl} y={-hw} width={hl * 2} height={hw * 2} rx={1.5} className="stadium-map__pitch" />
      <line x1={0} y1={-hw} x2={0} y2={hw} className="stadium-map__line" />
      <circle r={9.15} className="stadium-map__line" fill="none" />
      {item.kind === 'box' && (
        <rect
          x={-SKYBOX_HALF_SPAN}
          y={Math.sign(marker.z) > 0 ? BOWL.halfZ + SKYBOX.front : -(BOWL.halfZ + SKYBOX.back)}
          width={SKYBOX_HALF_SPAN * 2}
          height={SKYBOX.back - SKYBOX.front}
          className="stadium-map__boxes"
        />
      )}
      <path d={marker.block} className="stadium-map__block" />
      <circle cx={marker.x} cy={marker.z} r={11} className="stadium-map__pulse" />
      {/* no camarote o próprio retângulo é o marcador (o ponto o cobriria) */}
      {item.kind === 'seat' && <circle cx={marker.x} cy={marker.z} r={4.6} className="stadium-map__dot" />}
    </svg>
  )
}

/**
 * Código de barras 2D ilustrativo (com os três quadrados de canto de um QR),
 * gerado a partir do código do pedido. Não é um QR de verdade.
 */
export function TicketCode({ value }: { value: string }) {
  const cells = useMemo(() => {
    const n = 25
    let seed = 0
    for (const ch of value) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
    const rand = mulberry32(seed)
    const out: [number, number][] = []
    const finder = (x: number, y: number) => {
      const fx = x < 7 ? x : x >= n - 7 ? x - (n - 7) : -1
      const fy = y < 7 ? y : y >= n - 7 ? y - (n - 7) : -1
      if (fx < 0 || fy < 0 || (x >= n - 7 && y >= n - 7)) return null
      const edge = fx === 0 || fx === 6 || fy === 0 || fy === 6
      const core = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4
      return edge || core
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const f = finder(x, y)
        // separação branca em volta dos quadrados de canto
        const nearFinder =
          f === null &&
          ((x <= 7 && y <= 7) || (x >= n - 8 && y <= 7) || (x <= 7 && y >= n - 8))
        if (f === true || (f === null && !nearFinder && rand() < 0.48)) out.push([x, y])
      }
    }
    return { n, out }
  }, [value])

  return (
    <svg className="ticket-code" viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} role="img" aria-label="Código do ingresso (ilustrativo)">
      <rect x={-2} y={-2} width={cells.n + 4} height={cells.n + 4} fill="#fff" />
      {cells.out.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="#0f1115" />
      ))}
    </svg>
  )
}
