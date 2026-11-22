import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import { FOG } from '../config/world'
import { pixelUniforms } from './pixelScale'

const vertex = /* glsl */ `
uniform float uPixelAngle;
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
