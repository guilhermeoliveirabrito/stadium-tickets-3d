import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  OctahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildCrowd, PATH_SAMPLES } from '../../lib/city/crowd'
import { getCity } from '../../lib/city/layout'
import { addCityLight } from './cityLight'

const crowdTime = { value: 0 }

/** Pessoa bem simples (pernas, tronco e cabeça), com a frente em +Z e os pés em y = 0. */
function createPersonGeometry() {
  const paint = (g: BufferGeometry, rgb: [number, number, number]) => {
    const count = g.attributes.position.count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) colors.set(rgb, i * 3)
    g.setAttribute('color', new BufferAttribute(colors, 3))
    g.deleteAttribute('uv')
    return g
  }
  // as cores marcam as partes: branco puro vira a camisa, o tom de pele varia por pessoa
  return mergeGeometries([
    paint(new BoxGeometry(0.34, 0.84, 0.2).translate(0, 0.42, 0).toNonIndexed(), [0.11, 0.12, 0.16]),
    paint(new BoxGeometry(0.46, 0.62, 0.26).translate(0, 1.15, 0).toNonIndexed(), [1, 1, 1]),
    paint(new OctahedronGeometry(0.14, 0).translate(0, 1.6, 0.01), [0.93, 0.7, 0.56]),
  ])!
}

const vertexHeader = /* glsl */ `
uniform sampler2D uCrowdPaths;
uniform float uCrowdTime;
attribute vec4 aWalk;
attribute vec4 aLook;
attribute vec3 aShirt;
vec2 gWalkPos;
vec2 gWalkFwd;
float gWalkBob;

vec2 crowdPoint(float row, float u) {
  float x = clamp(u, 0.0, 1.0) * ${(PATH_SAMPLES - 1).toFixed(1)};
  float i = floor(x);
  vec2 a = texelFetch(uCrowdPaths, ivec2(int(i), int(row)), 0).xy;
  vec2 b = texelFetch(uCrowdPaths, ivec2(int(min(i + 1.0, ${(PATH_SAMPLES - 1).toFixed(1)})), int(row)), 0).xy;
  return mix(a, b, x - i);
}

void crowdWalk() {
  float len = aWalk.w;
  float s = aWalk.y + aWalk.z * uCrowdTime;
  float dir = sign(aWalk.z);
  float u;
  if (aLook.z < 0.5) {
    u = fract(s / len);
  } else {
    // vai e volta: chega no fim do caminho e dá meia-volta
    float p = mod(s / len, 2.0);
    u = p < 1.0 ? p : 2.0 - p;
    dir *= p < 1.0 ? 1.0 : -1.0;
  }
  float ahead = dir * 1.5 / len;
  vec2 here = crowdPoint(aWalk.x, u);
  vec2 next = crowdPoint(aWalk.x, aLook.z < 0.5 ? fract(u + ahead + 1.0) : u + ahead);
  vec2 d = next - here;
  gWalkFwd = dot(d, d) > 1e-6 ? normalize(d) : vec2(0.0, 1.0);
  gWalkPos = here + vec2(-gWalkFwd.y, gWalkFwd.x) * aLook.x;
  gWalkBob = abs(sin(uCrowdTime * 5.6 * abs(aWalk.z) + aLook.w * 40.0)) * 0.05;
}
`

/** Gira um vetor local (frente em +Z) para o rumo da caminhada. */
const rotate = (v: string) => `vec3(${v}.x * gWalkFwd.y + ${v}.z * gWalkFwd.x, ${v}.y, -${v}.x * gWalkFwd.x + ${v}.z * gWalkFwd.y)`

function createCrowdMaterial(paths: DataTexture) {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCrowdPaths = { value: paths }
    shader.uniforms.uCrowdTime = crowdTime
    addCityLight(shader, { strength: 2.4, falloff: 3 })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexHeader}`)
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        if (color.r > 0.99 && color.g > 0.99 && color.b > 0.99) vColor.rgb = aShirt;
        else if (color.r > 0.9 && color.g < 0.8) vColor.rgb = color * mix(0.42, 1.06, fract(aLook.w * 13.7));`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        crowdWalk();
        objectNormal = ${rotate('objectNormal')};`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 crowdLocal = position * vec3(1.0, aLook.y, 1.0);
        transformed = ${rotate('crowdLocal')} + vec3(gWalkPos.x, gWalkBob, gWalkPos.y);`,
      )
  }
  material.customProgramCacheKey = () => 'crowd'
  return material
}

export function Crowd() {
  const { geometry, material } = useMemo(() => {
    const plan = buildCrowd(getCity())
    const paths = new DataTexture(plan.paths, PATH_SAMPLES, plan.pathCount, RGBAFormat, FloatType)
    paths.magFilter = paths.minFilter = NearestFilter
    paths.needsUpdate = true

    const geometry = new InstancedBufferGeometry().copy(createPersonGeometry() as unknown as InstancedBufferGeometry)
    geometry.instanceCount = plan.count
    geometry.setAttribute('aWalk', new InstancedBufferAttribute(plan.walk, 4))
    geometry.setAttribute('aLook', new InstancedBufferAttribute(plan.look, 4))
    geometry.setAttribute('aShirt', new InstancedBufferAttribute(plan.shirt, 3))
    return { geometry, material: createCrowdMaterial(paths) }
  }, [])

  useFrame((_, delta) => {
    crowdTime.value += Math.min(delta, 0.1)
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
