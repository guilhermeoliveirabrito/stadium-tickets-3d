import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { mulberry32 } from './random'

const smooth = (t: number) => t * t * (3 - 2 * t)

function periodicNoise(size: number, cells: number, seed: number) {
  const rand = mulberry32(seed)
  const grid = Float32Array.from({ length: cells * cells }, () => rand())
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells
    const y0 = Math.floor(fy)
    const y1 = (y0 + 1) % cells
    const ty = smooth(fy - y0)
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells
      const x0 = Math.floor(fx)
      const x1 = (x0 + 1) % cells
      const tx = smooth(fx - x0)
      const a = grid[y0 * cells + x0]
      const b = grid[y0 * cells + x1]
      const c = grid[y1 * cells + x0]
      const d = grid[y1 * cells + x1]
      out[y * size + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
    }
  }
  return out
}

let sharedNoise: DataTexture | null = null

/** Ruído periódico com uma escala diferente em cada canal (R = grosso ... A = fino). */
export function getNoiseTexture() {
  if (sharedNoise) return sharedNoise
  const size = 256
  const data = new Uint8Array(size * size * 4)
  const scales = [4, 8, 16, 32]
  scales.forEach((cells, channel) => {
    const o1 = periodicNoise(size, cells, 11 + channel * 7)
    const o2 = periodicNoise(size, cells * 2, 23 + channel * 7)
    const o3 = periodicNoise(size, cells * 4, 37 + channel * 7)
    for (let i = 0; i < size * size; i++) {
      data[i * 4 + channel] = Math.round((o1[i] * 0.55 + o2[i] * 0.3 + o3[i] * 0.15) * 255)
    }
  })
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  sharedNoise = texture
  return texture
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  options: { srgb?: boolean; repeat?: boolean; anisotropy?: number } = {},
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx, width, height)
  const texture = new CanvasTexture(canvas)
  if (options.srgb !== false) texture.colorSpace = SRGBColorSpace
  if (options.repeat) texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = options.anisotropy ?? 8
  return texture
}
