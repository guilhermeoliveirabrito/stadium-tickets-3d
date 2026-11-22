import { Color, Vector3 } from 'three'

/**
 * Iluminação "pintada" nos materiais: em vez de dezenas de luzes reais (que
 * cada pixel da cena inteira teria de calcular), os refletores do estádio e o
 * clarão dos fogos entram como termos curtos só nos materiais que recebem
 * essa luz.
 */

/** Clarão dos fogos: posição no mundo e cor já multiplicada pela intensidade. */
export const flashUniforms = {
  uFlashPos: { value: new Vector3(0, -1000, 0) },
  uFlashColor: { value: new Color(0, 0, 0) },
}

export const FLASH_HEADER = /* glsl */ `
uniform vec3 uFlashPos;
uniform vec3 uFlashColor;
`

/** Soma o clarão ao irradiance. `worldPos` é uma expressão vec3 no espaço do mundo. */
export function flashTerm(worldPos: string) {
  return /* glsl */ `
  if (uFlashColor.r + uFlashColor.g + uFlashColor.b > 0.0) {
    vec3 toFlash = uFlashPos - (${worldPos});
    float flashDist2 = max(dot(toFlash, toFlash), 900.0);
    vec3 flashDir = normalize((viewMatrix * vec4(toFlash, 0.0)).xyz);
    irradiance += uFlashColor * max(dot(normal, flashDir), 0.0) / flashDist2;
  }`
}

/** Cor da luz dos refletores e da luz rebatida dentro do estádio. */
const FLOOD = '0.94, 0.96, 1.0'
const BOUNCE = '0.62, 0.64, 0.72'

/**
 * Refletores: luz vinda de cima do centro do campo (onde os feixes se cruzam)
 * mais a luz rebatida pelo gramado. `amount` escala os dois.
 */
export function floodTerm(amount: number) {
  if (amount <= 0) return ''
  return /* glsl */ `
  {
    vec3 floodView = (viewMatrix * vec4(0.0, 72.0, 0.0, 1.0)).xyz;
    float floodNdl = max(dot(normal, normalize(floodView + vViewPosition)), 0.0);
    irradiance += vec3(${BOUNCE}) * ${amount.toFixed(3)} + vec3(${FLOOD}) * floodNdl * ${(amount * 0.95).toFixed(3)};
  }`
}

export function setFlash(position: Vector3 | null, color: Color, intensity: number) {
  if (!position || intensity <= 0) {
    flashUniforms.uFlashColor.value.setRGB(0, 0, 0)
    return
  }
  flashUniforms.uFlashPos.value.copy(position)
  flashUniforms.uFlashColor.value.copy(color).multiplyScalar(intensity)
}
