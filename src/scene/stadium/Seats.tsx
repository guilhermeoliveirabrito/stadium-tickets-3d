import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  DataTexture,
  DoubleSide,
  Frustum,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  NearestFilter,
  Object3D,
  RedFormat,
  Sphere,
  UnsignedByteType,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { getLayout } from '../../lib/layout'
import { once } from '../../lib/once'
import { getSeatColors } from '../../lib/seatColors'
import { useExperience } from '../../store/experience'
import { extendShader, pixelUniforms } from '../pixelScale'
import { HIGHLIGHT_LINEAR, SELECTION_FUNCTIONS, SELECTION_HEADER, selectionUniforms } from '../selection'
import { withLocalFill } from './materials'
import { createDetailedSeatGeometry, createSeatGeometry } from './seatGeometry'

/**
 * As cadeiras 3D só aparecem de perto. Entre 3 e 2 pixels por cadeira elas
 * encolhem até sumir, enquanto o degrau embaixo passa a mostrar a cor delas
 * (ver o mapa de cadeiras em materials.ts). Abaixo disso nem são desenhadas.
 */
const SEAT_SHRINK = /* glsl */ `
#ifdef USE_INSTANCING
{
  vec4 seatView = modelViewMatrix * instanceMatrix * vec4(0.0, 0.6, 0.0, 1.0);
  float seatPx = 0.44 / max(-seatView.z * uPixelAngle, 1e-6);
  transformed *= smoothstep(2.0, 3.0, seatPx);
}
#endif
`

/**
 * Estados de cada cadeira: bloco em destaque (laranja), cadeira sob o cursor
 * (laranja forte, um pouco maior) e cadeira escolhida (branca, pulsando). Na
 * vista de frente, as cadeiras fora do bloco em foco ficam mais escuras.
 */
const SEAT_STATE_VERTEX = /* glsl */ `
vBlockHl = max(selIs(aSeatBlock, uHoverBlock) * 0.85, selIs(aSeatBlock, uSelectBlock));
vSeatHover = selIs(aSeatIndex, uHoverSeat);
vSeatPicked = selIs(aSeatIndex, uSelectSeat);
vSeatDim = step(0.0, uFocusBlock) * (1.0 - selIs(aSeatBlock, uFocusBlock));
transformed *= 1.0 + 0.16 * max(vSeatHover, vSeatPicked);
`

const SEAT_STATE_FRAGMENT = /* glsl */ `
diffuseColor.rgb = mix(diffuseColor.rgb, ${HIGHLIGHT_LINEAR} * 0.9, vBlockHl * 0.72);
diffuseColor.rgb *= 1.0 - vSeatDim * 0.55;
diffuseColor.rgb = mix(diffuseColor.rgb, ${HIGHLIGHT_LINEAR}, vSeatHover);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), vSeatPicked);
totalEmissiveRadiance += ${HIGHLIGHT_LINEAR} * (vBlockHl * 0.2 + vSeatHover * 0.7);
totalEmissiveRadiance += vec3(0.75) * vSeatPicked * (0.3 + 0.3 * uPulse);
`

const SEAT_VARYINGS = 'varying float vBlockHl;\nvarying float vSeatHover;\nvarying float vSeatPicked;\nvarying float vSeatDim;'

/** Versão leve: as cadeiras dos blocos que estão na versão detalhada somem daqui. */
const LIGHT_HANDOFF = /* glsl */ `
transformed *= 1.0 - step(0.5, texelFetch(uDetailMap, ivec2(int(aSeatBlock + 0.5), 0), 0).r);
`

/**
 * Versão detalhada: o pé de metal não leva a cor nem o destaque da cadeira, e
 * o plástico tem um brilho dos refletores (a mesma luz que vem de cima do
 * centro do campo, ver floodTerm).
 */
const DETAIL_TINT = /* glsl */ `
diffuseColor.rgb = mix(vec3(0.045, 0.047, 0.052), diffuseColor.rgb, vTint);
totalEmissiveRadiance *= vTint;
`

/** de longe o brilho cairia em fios de um pixel na borda do encosto, piscando com o movimento */
const DETAIL_SHEEN_FADE = /* glsl */ `
{
  vec4 sheenView = modelViewMatrix * instanceMatrix * vec4(0.0, 0.6, 0.0, 1.0);
  vSheenFade = smoothstep(6.0, 14.0, 0.44 / max(-sheenView.z * uPixelAngle, 1e-6));
}
`

const DETAIL_SHEEN = /* glsl */ `
{
  vec3 sheenLight = normalize((viewMatrix * vec4(0.0, 72.0, 0.0, 1.0)).xyz + vViewPosition);
  vec3 sheenHalf = normalize(sheenLight + normalize(vViewPosition));
  float sheen = pow(max(dot(normal, sheenHalf), 0.0), 28.0);
  reflectedLight.directDiffuse += vec3(0.95, 0.97, 1.0) * sheen * 0.2 * vTint * vSheenFade;
}
`

/** maior distância do centro do estádio até uma cadeira */
const FARTHEST_SEAT = 120
/** tamanho (pixels) a partir do qual um bloco passa para a versão detalhada, e abaixo do qual volta */
const DETAIL_IN_PX = 4
const DETAIL_OUT_PX = 3.4
/** o maior orçamento (nível alto), com folga para completar o último bloco */
const DETAIL_CAPACITY = 8600

/** Um texel por bloco: 1 quando o bloco está na versão detalhada. */
const getDetailMap = once(() => {
  const { blocks } = getLayout()
  const texture = new DataTexture(new Uint8Array(blocks.length), blocks.length, 1, RedFormat, UnsignedByteType)
  texture.magFilter = texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
})

function seatShader(kind: 'light' | 'detail') {
  const detail = kind === 'detail'
  return (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, pixelUniforms, selectionUniforms)
    if (!detail) shader.uniforms.uDetailMap = { value: getDetailMap() }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uPixelAngle;
        attribute float aSeatIndex;
        attribute float aSeatBlock;
        ${detail ? 'attribute float aTint;\nvarying float vTint;\nvarying float vSheenFade;' : 'uniform sampler2D uDetailMap;'}
        ${SEAT_VARYINGS}
        ${SELECTION_HEADER}
        ${SELECTION_FUNCTIONS}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${SEAT_STATE_VERTEX}
        ${SEAT_SHRINK}
        ${detail ? `vTint = aTint;\n${DETAIL_SHEEN_FADE}` : LIGHT_HANDOFF}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${SEAT_VARYINGS}\n${SELECTION_HEADER}\n${detail ? 'varying float vTint;\nvarying float vSheenFade;' : ''}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${SEAT_STATE_FRAGMENT}\n${detail ? DETAIL_TINT : ''}`,
      )
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${detail ? DETAIL_SHEEN : ''}`)
  }
}

/** Esfera envolvendo as cadeiras de cada bloco (para a distância e o enquadramento). */
const getBlockSpheres = once(() => {
  const { blocks, seats } = getLayout()
  const p = new Vector3()
  return blocks.map((block) => {
    const center = new Vector3()
    const end = block.seatStart + block.seatCount
    for (let i = block.seatStart; i < end; i++) center.add(p.fromArray(seats.position, i * 3))
    center.divideScalar(Math.max(1, block.seatCount))
    center.y += 0.6
    let radius = 0
    for (let i = block.seatStart; i < end; i++) radius = Math.max(radius, center.distanceTo(p.fromArray(seats.position, i * 3)))
    return new Sphere(center, radius + 0.8)
  })
})

/** Blocos vizinhos (anterior e seguinte) no mesmo anel. */
const getBlockNeighbors = once(() => {
  const { blocks } = getLayout()
  return blocks.map((block) => {
    const ring = blocks.filter((b) => b.tier === block.tier).map((b) => b.index)
    const k = ring.indexOf(block.index)
    return [ring[(k - 1 + ring.length) % ring.length], ring[(k + 1) % ring.length]]
  })
})

/** Dados por cadeira na ordem do layout (cada bloco é uma faixa contínua). */
const getSeatData = once(() => {
  const { seats } = getLayout()
  const colors = getSeatColors(seats)
  const index = new Float32Array(seats.count)
  for (let i = 0; i < seats.count; i++) index[i] = i
  const block = Float32Array.from(seats.block)
  const matrices = new Float32Array(seats.count * 16)
  const dummy = new Object3D()
  for (let i = 0; i < seats.count; i++) {
    dummy.position.fromArray(seats.position, i * 3)
    dummy.rotation.set(0, seats.yaw[i], 0)
    dummy.updateMatrix()
    dummy.matrix.toArray(matrices, i * 16)
  }
  return { colors, index, block, matrices }
})

const getSeatParts = once(() => ({
  lightGeometry: createSeatGeometry(),
  detailGeometry: createDetailedSeatGeometry(),
  lightMaterial: extendShader(
    withLocalFill(new MeshLambertMaterial({ side: DoubleSide }), 'seats', 1.15),
    'seat-light',
    seatShader('light'),
  ),
  detailMaterial: extendShader(withLocalFill(new MeshLambertMaterial(), 'seats-detail', 1.15), 'seat-detail', seatShader('detail')),
}))

/**
 * Cadeiras em duas versões: uma leve (quatro triângulos) para todas e uma
 * detalhada (concha moldada, cerca de 200 triângulos) só depois de escolher
 * um setor: o bloco escolhido e os vizinhos dele no mesmo anel, quando estão
 * enquadrados e perto o bastante, dentro do orçamento do nível de qualidade.
 */
export function Seats({ detailBudget }: { detailBudget: number }) {
  const { seats, blocks } = getLayout()
  const light = useRef<InstancedMesh>(null)
  const detail = useRef<InstancedMesh>(null)
  const parts = useMemo(() => getSeatParts(), [])

  useLayoutEffect(() => {
    const data = getSeatData()
    const { lightGeometry, detailGeometry } = getSeatParts()
    const mesh = light.current!
    mesh.instanceMatrix.array.set(data.matrices)
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(data.colors), 3)
    lightGeometry.setAttribute('aSeatIndex', new InstancedBufferAttribute(data.index, 1))
    lightGeometry.setAttribute('aSeatBlock', new InstancedBufferAttribute(data.block, 1))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()

    // a versão detalhada recebe só as cadeiras dos blocos escolhidos (ver abaixo)
    const near = detail.current!
    near.instanceColor = new InstancedBufferAttribute(new Float32Array(DETAIL_CAPACITY * 3), 3)
    detailGeometry.setAttribute('aSeatIndex', new InstancedBufferAttribute(new Float32Array(DETAIL_CAPACITY), 1))
    detailGeometry.setAttribute('aSeatBlock', new InstancedBufferAttribute(new Float32Array(DETAIL_CAPACITY), 1))
    near.count = 0
  }, [])

  const lod = useRef({
    frustum: new Frustum(),
    matrix: new Matrix4(),
    inSet: new Uint8Array(blocks.length),
    next: new Uint8Array(blocks.length),
    order: new Int16Array(blocks.length),
    score: new Float32Array(blocks.length),
  })

  useFrame((state) => {
    const mesh = light.current
    const near = detail.current
    if (!mesh || !near) return
    const camera = state.camera
    const pixelAngle = pixelUniforms.uPixelAngle.value
    // nem manda as 60 mil cadeiras para a placa de vídeo quando todas estão pequenas demais
    mesh.visible = 0.44 / (Math.max(1, camera.position.length() - FARTHEST_SEAT) * pixelAngle) > 1.9

    const l = lod.current
    const spheres = getBlockSpheres()
    const neighbors = getBlockNeighbors()
    const { phase, selectedBlock: selected } = useExperience.getState()
    // só com um setor escolhido: o bloco dele e os vizinhos do mesmo anel
    const choosing = (phase === 'sector' || phase === 'block') && selected >= 0
    let candidates = 0
    if (mesh.visible) {
      l.frustum.setFromProjectionMatrix(l.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
      for (let b = 0; b < spheres.length; b++) {
        // fora da escolha, os blocos detalhados ficam até encolherem com a distância (sem troca brusca)
        const wanted = choosing ? b === selected || neighbors[selected].includes(b) : l.inSet[b] === 1
        if (!wanted) continue
        const sphere = spheres[b]
        const distance = Math.max(1, camera.position.distanceTo(sphere.center) - sphere.radius)
        const px = 0.44 / (distance * pixelAngle)
        if (px < (l.inSet[b] ? DETAIL_OUT_PX : DETAIL_IN_PX) || !l.frustum.intersectsSphere(sphere)) continue
        l.score[b] = b === selected ? -1 : distance
        // inserção ordenada (poucos blocos, sem alocar nada)
        let k = candidates++
        while (k > 0 && l.score[l.order[k - 1]] > l.score[b]) {
          l.order[k] = l.order[k - 1]
          k--
        }
        l.order[k] = b
      }
    }
    l.next.fill(0)
    let total = 0
    for (let k = 0; k < candidates; k++) {
      const b = l.order[k]
      const count = blocks[b].seatCount
      if (total + count > Math.min(detailBudget, DETAIL_CAPACITY)) break
      total += count
      l.next[b] = 1
    }
    let changed = false
    for (let b = 0; b < blocks.length && !changed; b++) changed = l.next[b] !== l.inSet[b]
    if (!changed) return

    // troca de conjunto: copia as cadeiras dos blocos escolhidos para a versão detalhada
    l.inSet.set(l.next)
    const data = getSeatData()
    const { detailGeometry } = getSeatParts()
    const color = near.instanceColor!
    const seatIndex = detailGeometry.getAttribute('aSeatIndex') as InstancedBufferAttribute
    const seatBlock = detailGeometry.getAttribute('aSeatBlock') as InstancedBufferAttribute
    const map = getDetailMap()
    const flags = map.image.data as Uint8Array
    let n = 0
    for (let b = 0; b < blocks.length; b++) {
      flags[b] = l.inSet[b] * 255
      if (!l.inSet[b]) continue
      const start = blocks[b].seatStart
      const end = start + blocks[b].seatCount
      near.instanceMatrix.array.set(data.matrices.subarray(start * 16, end * 16), n * 16)
      color.array.set(data.colors.subarray(start * 3, end * 3), n * 3)
      seatIndex.array.set(data.index.subarray(start, end), n)
      seatBlock.array.set(data.block.subarray(start, end), n)
      n += end - start
    }
    near.count = n
    for (const [attribute, size] of [
      [near.instanceMatrix, 16],
      [color, 3],
      [seatIndex, 1],
      [seatBlock, 1],
    ] as const) {
      attribute.clearUpdateRanges()
      attribute.addUpdateRange(0, Math.max(1, n) * size)
      attribute.needsUpdate = true
    }
    map.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={light} args={[parts.lightGeometry, parts.lightMaterial, seats.count]} frustumCulled={false} />
      <instancedMesh ref={detail} args={[parts.detailGeometry, parts.detailMaterial, DETAIL_CAPACITY]} frustumCulled={false} />
    </group>
  )
}
