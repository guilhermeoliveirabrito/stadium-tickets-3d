import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, Mesh, ShaderMaterial } from 'three'
import { SUN_DIRECTION } from '../config/world'
import { getNoiseTexture } from '../lib/textures'

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

const fragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uClouds;
varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uGround, smoothstep(0.0, -0.06, h));

  // nuvens projetadas num plano alto
  if (uClouds > 0.0 && h > 0.0) {
    vec2 uv = dir.xz / (h + 0.08) * 0.16 + vec2(uTime * 0.0035, uTime * 0.0012);
    float n = texture2D(uNoise, uv).r * 0.55 + texture2D(uNoise, uv * 2.7 + 0.3).g * 0.3 + texture2D(uNoise, uv * 6.1).b * 0.15;
    float cover = smoothstep(0.5, 0.78, n) * smoothstep(0.02, 0.25, h);
    float light = 0.85 + 0.25 * dot(dir, uSunDir);
    col = mix(col, uHorizon * 1.15 * light, cover * uClouds);
  }

  float sun = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * (pow(sun, 1600.0) * 40.0 + pow(sun, 60.0) * 0.5 + pow(sun, 6.0) * 0.12);
  gl_FragColor = vec4(col, 1.0);
}
`

function createSkyMaterial(clouds = 1) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new Color('#2f6fd0') },
      uHorizon: { value: new Color('#d3e2ef') },
      uGround: { value: new Color('#6f7a64') },
      uSunDir: { value: SUN_DIRECTION.clone() },
      uSunColor: { value: new Color('#fff1d6') },
      uNoise: { value: getNoiseTexture() },
      uTime: { value: 0 },
      uClouds: { value: clouds },
    },
  })
}

export function GradientSky({ radius = 5000, animated = true, clouds = 1 }) {
  const material = useMemo(() => createSkyMaterial(clouds), [clouds])
  const mesh = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (animated && mesh.current) (mesh.current.material as ShaderMaterial).uniforms.uTime.value += delta
  })
  return (
    <mesh ref={mesh} scale={radius} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  )
}
