import { MeshStandardMaterial } from 'three'
import { addCityLight } from './cityLight'

const vertexHeader = /* glsl */ `
attribute vec4 aBuilding;
varying vec3 vBLocal;
varying vec3 vBNormal;
varying vec3 vBScale;
varying vec4 vBInfo;
`

const vertexBody = /* glsl */ `
vec3 bScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
vBLocal = position * bScale;
vBNormal = normal;
vBScale = bScale;
vBInfo = aBuilding;
`

// aBuilding: x = semente, y = tipo (0 casa, 1 prédio, 2 torre), z = lojas no térreo, w = fração de janelas acesas
const fragmentHeader = /* glsl */ `
uniform float uWindowGlow;
varying vec3 vBLocal;
varying vec3 vBNormal;
varying vec3 vBScale;
varying vec4 vBInfo;

float wHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void windowLight(out float glass, out vec3 emission) {
  glass = 0.0;
  emission = vec3(0.0);
  vec3 n = vBNormal;
  if (abs(n.y) > 0.5) return;

  float u;
  float width;
  float face;
  if (abs(n.x) > 0.5) {
    u = vBLocal.z;
    width = vBScale.z;
    face = n.x > 0.0 ? 1.0 : 2.0;
  } else {
    u = vBLocal.x;
    width = vBScale.x;
    face = n.z > 0.0 ? 3.0 : 4.0;
  }

  float tower = step(1.5, vBInfo.y);
  float colW = mix(2.9, 2.3, tower);
  float floorH = mix(3.0, 3.4, tower);
  float cols = floor((width - 1.0) / colW);
  float floors = floor((vBScale.y - 0.9) / floorH);
  if (cols < 1.0 || floors < 1.0) return;

  float gx = (u + cols * colW * 0.5) / colW;
  float gy = (vBLocal.y - 0.55) / floorH;
  if (gx < 0.0 || gx >= cols || gy < 0.0 || gy >= floors) return;

  vec2 id = floor(vec2(gx, gy));
  vec2 f = fract(vec2(gx, gy));
  vec2 fw = fwidth(vec2(gx, gy));
  float halfW = mix(0.25, 0.38, tower);
  float halfH = mix(0.24, 0.36, tower);
  float wx = 1.0 - smoothstep(halfW - fw.x, halfW + fw.x, abs(f.x - 0.5));
  float wy = 1.0 - smoothstep(halfH - fw.y, halfH + fw.y, abs(f.y - 0.52));
  float win = wx * wy;

  float seed = vBInfo.x * 97.0 + face * 13.1;
  float r = wHash(id + seed);
  float litRatio = vBInfo.w;
  float lit = step(1.0 - litRatio, r);
  float tone = wHash(id * 1.37 + seed + 4.1);
  vec3 warm = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.78, 0.46), tone);
  vec3 c = tone > 0.87 ? vec3(0.48, 0.68, 1.0) : warm;
  float strength = (0.5 + 1.2 * fract(r * 7.13)) * lit;

  // vitrines acesas no térreo dos prédios das avenidas
  if (vBInfo.z > 0.5 && id.y < 0.5) {
    c = vec3(1.0, 0.86, 0.64);
    strength = 1.7;
    win = wx * (1.0 - smoothstep(0.38, 0.42, abs(f.y - 0.5)));
  }

  // de longe a grade de janelas vira um brilho médio, sem serrilhado
  float lod = clamp(max(fw.x, fw.y) * 1.2 - 0.6, 0.0, 1.0);
  vec3 average = vec3(1.0, 0.66, 0.34) * litRatio * (4.0 * halfW * halfH) * 0.55;
  emission = mix(c * strength * win, average, lod) * uWindowGlow;
  glass = mix(win, 4.0 * halfW * halfH * 0.6, lod);
}
`

export function createBuildingMaterial(glow = 2.4) {
  const material = new MeshStandardMaterial({ roughness: 0.82, metalness: 0.02 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindowGlow = { value: glow }
    addCityLight(shader, { strength: 1.2, falloff: 4 })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexHeader}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentHeader}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float bGlass;
        vec3 bWindow;
        windowLight(bGlass, bWindow);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.03, 0.04), bGlass);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.18, bGlass);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += bWindow;`,
      )
  }
  material.customProgramCacheKey = () => 'building-windows'
  return material
}
