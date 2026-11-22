// Gramado procedural: faixas de corte, variação de cor e marcações oficiais
// (FIFA, 105 x 68 m) calculadas por distância, com antisserrilhado no shader.
export const pitchShaderChunk = /* glsl */ `
varying vec2 vPitch;
uniform sampler2D uNoise;

float sdBox2(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float pitchLines(vec2 p) {
  vec2 a = abs(p);
  float d = abs(sdBox2(p, vec2(52.5, 34.0)));
  d = min(d, sdSeg(a, vec2(0.0), vec2(0.0, 34.0)));
  d = min(d, abs(length(p) - 9.15));
  d = min(d, sdSeg(a, vec2(36.0, 0.0), vec2(36.0, 20.16)));
  d = min(d, sdSeg(a, vec2(36.0, 20.16), vec2(52.5, 20.16)));
  d = min(d, sdSeg(a, vec2(47.0, 0.0), vec2(47.0, 9.16)));
  d = min(d, sdSeg(a, vec2(47.0, 9.16), vec2(52.5, 9.16)));
  float arc = abs(length(a - vec2(41.5, 0.0)) - 9.15);
  d = min(d, a.x < 36.0 ? arc : 1e3);
  float corner = abs(length(a - vec2(52.5, 34.0)) - 1.0);
  d = min(d, (a.x < 52.5 && a.y < 34.0) ? corner : 1e3);
  return d;
}

float pitchSpots(vec2 p) {
  vec2 a = abs(p);
  return min(length(p) - 0.15, length(a - vec2(41.5, 0.0)) - 0.11);
}

vec3 pitchColor(vec2 p) {
  vec2 a = abs(p);
  float px = max(length(fwidth(p)), 1e-4);

  float band = floor((p.x + 105.0) / 5.25);
  float stripe = mod(band, 2.0);
  // listras transversais suaves dentro de cada faixa
  float cross = mod(floor((p.y + 68.0) / 8.5), 2.0);
  vec3 grass = vec3(0.046, 0.19, 0.024);
  grass *= mix(0.8, 1.16, stripe) * mix(0.97, 1.03, cross);

  vec4 n1 = texture2D(uNoise, p * 0.011);
  vec4 n2 = texture2D(uNoise, p * 0.085 + 0.37);
  grass *= 0.86 + 0.26 * n1.r;
  grass *= 0.93 + 0.14 * n2.a;

  float wear = smoothstep(8.0, 0.0, length(a - vec2(50.0, 0.0))) * 0.55;
  wear += smoothstep(5.0, 0.0, length(p)) * 0.2;
  wear *= smoothstep(0.3, 0.75, n2.b);
  grass = mix(grass, vec3(0.15, 0.13, 0.06), wear * 0.5);

  float outside = step(0.0, sdBox2(p, vec2(53.5, 35.0)));
  grass *= mix(1.0, 0.88, outside);

  float w = 0.06;
  float d = pitchLines(p);
  float line = smoothstep(w + px, w - px, d) * clamp(w * 1.6 / px, 0.0, 1.0);
  float ds = pitchSpots(p);
  line = max(line, smoothstep(px, -px, ds));
  return mix(grass, vec3(0.8, 0.82, 0.8), line * 0.94);
}
`
