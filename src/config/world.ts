import { Vector3 } from 'three'

const deg = Math.PI / 180

// Sol vindo de nordeste, fim de tarde (hemisfério sul).
const sunElevation = 48 * deg
const sunAzimuth = 38 * deg

export const SUN_DIRECTION = new Vector3(
  Math.cos(sunElevation) * Math.sin(sunAzimuth),
  Math.sin(sunElevation),
  -Math.cos(sunElevation) * Math.cos(sunAzimuth),
).normalize()

export const SKY = {
  turbidity: 6,
  rayleigh: 1.15,
  mieCoefficient: 0.0045,
  mieDirectionalG: 0.82,
}

export const FOG = { color: '#c9d5df', near: 900, far: 3600 }
