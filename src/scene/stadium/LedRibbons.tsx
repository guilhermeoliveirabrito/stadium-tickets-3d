import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { ClampToEdgeWrapping, DoubleSide, MeshBasicMaterial, NoColorSpace, RepeatWrapping } from 'three'
import { getLayout } from '../../lib/layout'
import { once } from '../../lib/once'
import { buildRibbon } from '../../lib/ribbon'
import { canvasTexture } from '../../lib/textures'
import { HIGHLIGHT_LINEAR, SELECTION_FUNCTIONS, SELECTION_HEADER, selectionUniforms } from '../selection'
import { drawGithub } from './ledContent'

const MASK_WIDTH = 2048
const MASK_HEIGHT = 192
/** velocidade do letreiro (m/s) */
const SPEED = 2.4

/** Máscara do letreiro (branco = LED aceso com o texto): o endereço do GitHub do autor. */
function drawMask(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  drawGithub(ctx, w / 2, h / 2, h * 0.5, w * 0.84, '#fff', '#b8b8b8')
  // losango entre as repetições (metade em cada ponta)
  ctx.fillStyle = '#fff'
  for (const x of [0, w]) {
    ctx.beginPath()
    ctx.moveTo(x, h / 2 - h * 0.13)
    ctx.lineTo(x + h * 0.13, h / 2)
    ctx.lineTo(x, h / 2 + h * 0.13)
    ctx.lineTo(x - h * 0.13, h / 2)
    ctx.fill()
  }
}

/**
 * Letreiro de LED: fundo azul e texto branco, rolando. A parte na frente do
 * bloco sob o cursor (ou escolhido) acende em laranja; na vista de frente de
 * um bloco, o resto da faixa escurece.
 */
const LED_FRAGMENT = /* glsl */ `
float ledMask = texture2D(uRibbonMask, vec2(vRibbonUv.x / uRibbonRepeat + uRibbonOffset, vRibbonUv.y)).r;
float ledPicked = selIs(vRibbonBlock, uSelectBlock);
float ledHl = max(selIs(vRibbonBlock, uHoverBlock) * 0.85, ledPicked);
float ledFocus = step(0.0, uFocusBlock);
float ledOther = ledFocus * (1.0 - selIs(vRibbonBlock, uFocusBlock));
vec3 ledBack = mix(vec3(0.012, 0.035, 0.85), ${HIGHLIGHT_LINEAR} * (1.05 + 0.25 * uPulse * ledPicked), ledHl);
vec3 ledColor = mix(ledBack, vec3(1.45, 1.45, 1.5), ledMask);
// borda do painel um pouco mais apagada, como os módulos de LED
ledColor *= 0.86 + 0.14 * smoothstep(0.0, 0.18, vRibbonUv.y) * smoothstep(1.0, 0.82, vRibbonUv.y);
ledColor *= 1.0 - ledOther * 0.75 - ledFocus * (1.0 - ledOther) * 0.2;
vec4 diffuseColor = vec4(ledColor, opacity);
`

const getRibbons = once(() => {
  const layout = getLayout()
  const mask = canvasTexture(MASK_WIDTH, MASK_HEIGHT, drawMask, { srgb: false })
  mask.colorSpace = NoColorSpace
  mask.wrapS = RepeatWrapping
  mask.wrapT = ClampToEdgeWrapping

  return (['middle', 'upper'] as const).map((tier) => {
    const ribbon = buildRibbon(layout, tier, MASK_WIDTH / MASK_HEIGHT)
    const offset = { value: 0 }
    const material = new MeshBasicMaterial({ side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, selectionUniforms, {
        uRibbonMask: { value: mask },
        uRibbonRepeat: { value: ribbon.repeat },
        uRibbonOffset: offset,
      })
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aBlock;\nattribute vec2 aRibbonUv;\nvarying float vRibbonBlock;\nvarying vec2 vRibbonUv;',
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRibbonBlock = aBlock;\nvRibbonUv = aRibbonUv;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uRibbonMask;
          uniform float uRibbonRepeat;
          uniform float uRibbonOffset;
          varying float vRibbonBlock;
          varying vec2 vRibbonUv;
          ${SELECTION_HEADER}
          ${SELECTION_FUNCTIONS}`,
        )
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', LED_FRAGMENT)
    }
    material.customProgramCacheKey = () => 'led-ribbon'
    return { ...ribbon, material, offset, mask }
  })
})

export function LedRibbons() {
  const ribbons = useMemo(() => getRibbons(), [])

  useEffect(() => {
    // redesenha quando a fonte terminar de carregar
    document.fonts?.ready.then(() => {
      const mask = ribbons[0].mask
      const canvas = mask.image as HTMLCanvasElement
      drawMask(canvas.getContext('2d')!, canvas.width, canvas.height)
      mask.needsUpdate = true
    })
  }, [ribbons])

  useFrame((_, delta) => {
    for (const r of getRibbons()) r.offset.value = (r.offset.value + (delta * SPEED) / r.repeat) % 1
  })

  return (
    <group>
      {ribbons.map((r, i) => (
        <mesh key={i} geometry={r.geometry} material={r.material} />
      ))}
    </group>
  )
}
