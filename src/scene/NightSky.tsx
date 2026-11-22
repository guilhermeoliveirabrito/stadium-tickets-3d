import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, Mesh, ShaderMaterial } from 'three'
import { MOON_IN_SKY, NIGHT } from '../config/world'
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
uniform vec3 uGlow;
uniform vec3 uGround;
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uClouds;
uniform float uStars;
varying vec3 vDir;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 starLayer(vec3 dir, float scale, float density, float gain) {
  vec3 p = dir * scale;
  vec3 cell = floor(p);
  float h = hash13(cell);
  if (h < 1.0 - density) return vec3(0.0);
  vec3 jitter = vec3(hash13(cell + 1.7), hash13(cell + 5.3), hash13(cell + 9.1)) - 0.5;
  float d = length(p - (cell + 0.5 + jitter * 0.5));
  float size = mix(0.12, 0.3, hash13(cell + 3.3));
  float b = 1.0 - smoothstep(0.0, size, d);
  float twinkle = 0.65 + 0.35 * sin(uTime * (0.8 + h * 2.5) + h * 61.0);
  vec3 tint = mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.88, 0.72), hash13(cell + 7.9));
  return tint * b * b * twinkle * gain;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  float up = clamp(h, 0.0, 1.0);

  vec3 col = mix(uHorizon, uZenith, pow(up, 0.42));
  col += uGlow * pow(1.0 - up, 10.0) * 0.7;
  col = mix(col, uGround, smoothstep(0.0, -0.05, h));

  float cover = 0.0;
  if (h > 0.0) {
    vec2 uv = dir.xz / (h + 0.1) * 0.14 + vec2(uTime * 0.0025, uTime * 0.001);
    float n = texture2D(uNoise, uv).r * 0.55 + texture2D(uNoise, uv * 2.6 + 0.3).g * 0.3 + texture2D(uNoise, uv * 6.3).b * 0.15;
    cover = smoothstep(0.52, 0.8, n) * smoothstep(0.03, 0.3, h) * uClouds;
  }

  float m = max(dot(dir, uMoonDir), 0.0);
  float halo = pow(m, 36.0) * 0.06 + pow(m, 600.0) * 0.35;

  // nuvens escuras, iluminadas por baixo pela cidade e pela lua
  vec3 cloud = mix(uHorizon * 1.35, uGlow * 0.9, 0.35) + uMoonColor * halo * 0.6;
  col = mix(col, cloud, cover * 0.85);

  vec3 stars = starLayer(dir, 210.0, 0.045, 2.6) + starLayer(dir, 460.0, 0.05, 1.3);
  col += stars * uStars * smoothstep(0.04, 0.35, h) * (1.0 - cover);

  float disk = smoothstep(0.99979, 0.99988, m);
  float craters = 0.82 + 0.18 * texture2D(uNoise, (dir.xy - uMoonDir.xy) * 22.0 + 0.5).r;
  col += uMoonColor * (disk * 4.0 * craters + halo) * (1.0 - cover * 0.7);

  gl_FragColor = vec4(col, 1.0);
}
`

function createSkyMaterial(clouds: number, stars: number) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new Color(NIGHT.zenith) },
      uHorizon: { value: new Color(NIGHT.horizon) },
      uGlow: { value: new Color(NIGHT.glow) },
      uGround: { value: new Color(NIGHT.ground) },
      uMoonDir: { value: MOON_IN_SKY.clone() },
      uMoonColor: { value: new Color(NIGHT.moon) },
      uNoise: { value: getNoiseTexture() },
      uTime: { value: 0 },
      uClouds: { value: clouds },
      uStars: { value: stars },
    },
  })
}

export function NightSky({ radius = 5000, animated = true, clouds = 1, stars = 1 }) {
  const material = useMemo(() => createSkyMaterial(clouds, stars), [clouds, stars])
  const mesh = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (animated && mesh.current) (mesh.current.material as ShaderMaterial).uniforms.uTime.value += delta
  })
  return (
    // desenhado depois do resto: só os pixels onde o céu aparece de fato são calculados
    <mesh ref={mesh} scale={radius} material={material} renderOrder={1000} frustumCulled={false}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  )
}
