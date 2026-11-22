import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvasTexture } from '../../lib/textures'

// Carro com a frente em +Z, 4,4 m de comprimento.

function paint(g: BufferGeometry, color: [number, number, number] | ((ny: number) => [number, number, number])) {
  const normal = g.attributes.normal
  const count = g.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors.set(typeof color === 'function' ? color(normal.getY(i)) : color, i * 3)
  }
  g.setAttribute('color', new BufferAttribute(colors, 3))
  g.deleteAttribute('uv')
  return g
}

/** Carroceria: a cor vem da instância; os vidros são escuros. */
export function createCarBody() {
  const body = paint(new BoxGeometry(1.82, 0.72, 4.4).translate(0, 0.5, 0), [1, 1, 1])

  const cabin = new BoxGeometry(1.62, 0.52, 2.3)
  const pos = cabin.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) pos.setXYZ(i, pos.getX(i) * 0.88, pos.getY(i), pos.getZ(i) * 0.74)
  }
  cabin.computeVertexNormals()
  cabin.translate(0, 1.12, -0.18)
  // teto na cor do carro, laterais como vidro escuro
  paint(cabin, (ny) => (ny > 0.6 ? [1, 1, 1] : [0.05, 0.06, 0.07]))

  // sem rodas: de cima elas não aparecem e seriam o dobro de triângulos
  return mergeGeometries([body, cabin])!
}

/** Faróis (cor quente) e lanternas (vermelhas), em malhas separadas para a luz de freio. */
export function createHeadlights() {
  return mergeGeometries(
    [-1, 1].map((sx) => paint(new BoxGeometry(0.36, 0.14, 0.05).translate(sx * 0.62, 0.7, 2.21), [1, 0.93, 0.8])),
  )!
}

export function createTaillights() {
  return mergeGeometries(
    [-1, 1].map((sx) => paint(new BoxGeometry(0.34, 0.13, 0.05).translate(sx * 0.66, 0.76, -2.21), [1, 0.05, 0.03])),
  )!
}

let beamTexture: CanvasTexture | null = null

/** Mancha de luz que os faróis projetam no asfalto. */
export function getBeamTexture() {
  if (!beamTexture) {
    beamTexture = canvasTexture(
      128,
      256,
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h)
        // o feixe sai da frente do carro (topo da textura) e se abre para longe
        const grad = ctx.createRadialGradient(w / 2, -h * 0.02, 2, w / 2, h * 0.25, h * 0.8)
        grad.addColorStop(0, 'rgba(255,255,255,1)')
        grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = grad
        ctx.filter = 'blur(10px)'
        ctx.beginPath()
        ctx.moveTo(w * 0.36, 0)
        ctx.lineTo(w * 0.02, h)
        ctx.lineTo(w * 0.98, h)
        ctx.lineTo(w * 0.64, 0)
        ctx.closePath()
        ctx.fill()
        ctx.filter = 'none'
      },
      { srgb: false },
    )
  }
  return beamTexture
}

export function createBeamGeometry() {
  // plano deitado à frente do carro, do para-choque até 17 m
  return new PlaneGeometry(6, 15).rotateX(-Math.PI / 2).translate(0, 0.07, 2.2 + 7.5)
}

export function createTailGlowGeometry() {
  return new PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2).translate(0, 0.06, -3.2)
}
