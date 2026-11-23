import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import { FOG } from '../config/world'
import { OUTSIDE_FOG_RADII, outsideFog } from './outsideFog'
import { pixelUniforms } from './pixelScale'

const vertex = /* glsl */ `
uniform float uPixelAngle;
uniform float uOutsideFog;
uniform float uSize;
uniform float uMinPx;
uniform float uIntensity;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.5);
  float trueSize = uSize / (dist * uPixelAngle);
  float size = max(trueSize, uMinPx);
  // Nunca menor que uMinPx pixels, para não piscar entre os pixels. Quando é
  // desenhado maior que o tamanho real, o brilho cai na mesma proporção, então
  // de longe a luz vira um ponto suave em vez de um pixel estourado.
  float energy = (trueSize * trueSize) / (size * size);
  float fog = 1.0 - smoothstep(${FOG.near.toFixed(1)}, ${(FOG.far * 1.4).toFixed(1)}, dist) * 0.75;
  // vistas de dentro do estádio: as luzes de fora somem junto com o entorno (ver outsideFog.ts)
  vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
  fog *= 1.0 - smoothstep(${OUTSIDE_FOG_RADII[0].toFixed(1)}, ${OUTSIDE_FOG_RADII[1].toFixed(1)}, length(world.xz)) * uOutsideFog;
  vColor = aColor * uIntensity * pow(energy, 0.7) * fog;
  gl_PointSize = dot(aColor, aColor) > 0.0 ? size : 0.0;
}
`

const fragment = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  float glow = max(exp(-r2 * 5.0) - 0.0067, 0.0);
  gl_FragColor = vec4(vColor * glow, 1.0);
}
`

export function createGlowMaterial(size: number, intensity: number, minPx = 2.5) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      ...pixelUniforms,
      uOutsideFog: outsideFog,
      uSize: { value: size },
      uMinPx: { value: minPx },
      uIntensity: { value: intensity },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

export function createGlowGeometry(positions: Float32Array, colors: Float32Array) {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setAttribute('aColor', new BufferAttribute(colors, 3))
  return g
}
