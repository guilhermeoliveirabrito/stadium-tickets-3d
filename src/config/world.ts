import { Vector3 } from 'three'

const deg = Math.PI / 180

// Sol de sul-sudoeste: ilumina de frente a arquibancada norte, onde ficam os
// blocos centrais, e projeta a sombra da cobertura sobre parte do gramado.
const sunElevation = 44 * deg
const sunAzimuth = 202 * deg

export const SUN_DIRECTION = new Vector3(
  Math.cos(sunElevation) * Math.sin(sunAzimuth),
  Math.sin(sunElevation),
  -Math.cos(sunElevation) * Math.cos(sunAzimuth),
).normalize()

export const FOG = { color: '#cbd9e6', near: 800, far: 3800 }
