/**
 * Destaque de blocos e cadeiras nos shaders. Os valores vêm do estado da
 * experiência (ver SelectionSync) e são lidos pelos materiais das
 * arquibancadas e das cadeiras.
 */
export const selectionUniforms = {
  uHoverBlock: { value: -1 },
  uSelectBlock: { value: -1 },
  /** bloco em foco na vista de frente: os outros ficam mais escuros */
  uFocusBlock: { value: -1 },
  uHoverSeat: { value: -1 },
  uSelectSeat: { value: -1 },
  /** camarote sob o cursor e camarote aberto */
  uHoverBox: { value: -1 },
  uSelectBox: { value: -1 },
  /** 0 a 1, pulsando devagar */
  uPulse: { value: 0 },
}

export const SELECTION_HEADER = /* glsl */ `
uniform float uHoverBlock;
uniform float uSelectBlock;
uniform float uFocusBlock;
uniform float uHoverSeat;
uniform float uSelectSeat;
uniform float uHoverBox;
uniform float uSelectBox;
uniform float uPulse;
`

/** 1 quando o id é igual ao uniform (e o uniform é válido) */
export const SELECTION_FUNCTIONS = /* glsl */ `
float selIs(float id, float target) {
  return step(0.0, target) * (1.0 - step(0.5, abs(id - target)));
}
`

/** cor do destaque (laranja da marca) em espaço linear */
export const HIGHLIGHT_LINEAR = 'vec3(1.0, 0.102, 0.0137)'
