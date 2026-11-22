import { MeshBasicMaterial } from 'three'

/** Relógio compartilhado por todos os materiais de neon. */
export const neonTime = { value: 0 }

const vertexChunk = /* glsl */ `
vec4 neonWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  neonWorld = instanceMatrix * neonWorld;
#endif
neonWorld = modelMatrix * neonWorld;
vNeonWorld = neonWorld.xyz;
`

const fragmentHeader = /* glsl */ `
uniform float uNeonTime;
uniform float uNeonIntensity;
uniform float uNeonPulse;
varying vec3 vNeonWorld;

vec3 neonPalette(float t) {
  vec3 red = vec3(1.0, 0.08, 0.22);
  vec3 magenta = vec3(0.82, 0.1, 1.0);
  vec3 blue = vec3(0.12, 0.3, 1.0);
  vec3 cyan = vec3(0.05, 0.8, 1.0);
  t = fract(t) * 4.0;
  if (t < 1.0) return mix(red, magenta, smoothstep(0.0, 1.0, t));
  if (t < 2.0) return mix(magenta, blue, smoothstep(1.0, 2.0, t));
  if (t < 3.0) return mix(blue, cyan, smoothstep(2.0, 3.0, t));
  return mix(cyan, red, smoothstep(3.0, 4.0, t));
}

vec3 neonColor(vec3 p) {
  float around = atan(p.z, p.x) / 6.2831853;
  vec3 c = neonPalette(around * 2.0 - uNeonTime * 0.04);
  // pulsos de luz subindo pelas faixas
  float wave = 0.5 + 0.5 * sin(p.y * 0.2 - uNeonTime * 2.4 + around * 40.0);
  float pulse = pow(wave, 8.0) * uNeonPulse;
  return c * uNeonIntensity * (0.7 + pulse) + vec3(pulse * 0.25 * uNeonIntensity);
}
`

/**
 * Material emissivo para as faixas de LED. A cor depende da posição em volta
 * do estádio e anda devagar com o tempo.
 */
export function createNeonMaterial(key: string, intensity = 3.2, pulse = 1) {
  const material = new MeshBasicMaterial()
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNeonTime = neonTime
    shader.uniforms.uNeonIntensity = { value: intensity }
    shader.uniforms.uNeonPulse = { value: pulse }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNeonWorld;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexChunk}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentHeader}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( neonColor(vNeonWorld), opacity );')
  }
  material.customProgramCacheKey = () => `neon-${key}`
  return material
}
