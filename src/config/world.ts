import { Vector3 } from 'three'

const deg = Math.PI / 180

function direction(azimuthDeg: number, elevationDeg: number) {
  const az = azimuthDeg * deg
  const el = elevationDeg * deg
  return new Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize()
}

// Lua baixa a lés-nordeste: aparece atrás do estádio no começo da abertura.
export const MOON_IN_SKY = direction(62, 12.5)
// A luz do luar vem do mesmo lado, mas mais alta, para as sombras não ficarem enormes.
export const MOONLIGHT_DIRECTION = direction(62, 40)

export const NIGHT = {
  zenith: '#020409',
  horizon: '#111a33',
  /** brilho da cidade refletido no céu, perto do horizonte */
  glow: '#3b2c4d',
  ground: '#05070b',
  moon: '#dfe7ff',
  moonlight: { color: '#9fb6ff', intensity: 0.42 },
  hemisphere: { sky: '#1b2a52', ground: '#0a0c10', intensity: 0.32 },
  environmentIntensity: 0.55,
  exposure: 1.05,
}

export const FOG = { color: '#0a1122', near: 520, far: 2600 }
