import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  Float32BufferAttribute,
  type Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  type Material,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SEAT_COLORS, SKYBOX } from '../../config/stadium'
import { frameAt, SEGMENTS, type Frame } from '../../lib/bowl'
import { frameMatrix } from '../../lib/instancing'
import { once } from '../../lib/once'
import { mulberry32 } from '../../lib/random'
import { getSkyboxes, SKYBOX_INDEX_GLSL, SKYBOX_SEGMENTS } from '../../lib/skyboxes'
import { profile, SweepBuilder } from '../../lib/sweep'
import { extendShader } from '../pixelScale'
import { HIGHLIGHT_LINEAR, SELECTION_FUNCTIONS, SELECTION_HEADER, selectionUniforms } from '../selection'
import { FrameInstances } from './FrameInstances'
import { withSurfaceNoise } from './materials'
import { createSkyboxNumbers, createSkyboxWallTextures, NUMBER_COLUMNS, NUMBER_ROWS } from './skyboxArt'

const OTHER_SEGMENTS = [1, 2, 3, 5, 6, 7]
/** de longe (visão geral, abertura) os camarotes ficam escondidos embaixo do anel intermediário */
const VISIBLE_WITHIN = 320
/** poltronas arredondadas só com a câmera perto de algum camarote (vista do camarote) */
const ROUNDED_WITHIN = 45
const CHAIR_SPACING = 0.85
const INNER_WIDTH = SKYBOX.width - 0.16
const COUNTER_D = SKYBOX.back - 1.3
const WALL_D = SKYBOX.back - 0.31
const TOP_FLOOR = SKYBOX.rows[SKYBOX.rows.length - 1][1]

/**
 * Luz de dentro dos camarotes: quente, vinda do teto, um pouco mais forte no
 * camarote sob o cursor e no camarote aberto. O camarote de cada ponto sai da
 * posição no mundo (as laterais com camarotes são retas ao longo de x).
 */
function withBoxLight<T extends Material>(material: T, key: string, strength: number) {
  return extendShader(material, `box-light-${key}`, (shader) => {
    Object.assign(shader.uniforms, selectionUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBoxWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 boxWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            boxWorld = instanceMatrix * boxWorld;
          #endif
          vBoxWorld = (modelMatrix * boxWorld).xyz;
        }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vBoxWorld;\n${SELECTION_HEADER}\n${SELECTION_FUNCTIONS}\n${SKYBOX_INDEX_GLSL}`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        {
          float boxId = skyboxIndexAt(vBoxWorld);
          float boxLevel = step(0.0, boxId) * (1.0 + 0.4 * selIs(boxId, uHoverBox) + 0.55 * selIs(boxId, uSelectBox));
          vec3 boxUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float boxSky = 0.5 + 0.5 * dot(normal, boxUp);
          irradiance += vec3(1.0, 0.8, 0.6) * ${strength.toFixed(2)} * (0.3 + 0.7 * boxSky) * boxLevel;
        }`,
      )
  })
}

/**
 * Poltrona de couro: assento e encosto arredondados, braços e base. De longe
 * (vista do setor, a poltrona com poucos pixels) usa a mesma forma em caixas
 * retas, com um quarto dos triângulos.
 */
function createArmchairGeometry(rounded = true): BufferGeometry {
  const parts = [
    new BoxGeometry(0.6, 0.2, 0.56).translate(0, 0.1, 0),
    (rounded ? new RoundedBoxGeometry(0.58, 0.17, 0.58, 1, 0.06) : new BoxGeometry(0.58, 0.17, 0.58)).translate(0, 0.29, 0.03),
    (rounded ? new RoundedBoxGeometry(0.64, 0.56, 0.17, 1, 0.07) : new BoxGeometry(0.64, 0.56, 0.17))
      .rotateX(-0.16)
      .translate(0, 0.62, -0.25),
    new BoxGeometry(0.09, 0.2, 0.6).translate(-0.33, 0.44, 0.02),
    new BoxGeometry(0.09, 0.2, 0.6).translate(0.33, 0.44, 0.02),
  ]
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!
  g.deleteAttribute('uv')
  return g
}

/** Pessoa (sentada ou em pé): aSkin = 1 no rosto, aPants = 1 nas pernas. */
function createPersonGeometry(seated: boolean): BufferGeometry {
  const part = (g: BufferGeometry, skin: number, pants: number) => {
    const flat = g.index ? g.toNonIndexed() : g
    flat.deleteAttribute('uv')
    const n = flat.getAttribute('position').count
    flat.setAttribute('aSkin', new Float32BufferAttribute(new Array(n).fill(skin), 1))
    flat.setAttribute('aPants', new Float32BufferAttribute(new Array(n).fill(pants), 1))
    return flat
  }
  const parts = seated
    ? [
        part(new BoxGeometry(0.36, 0.5, 0.22).translate(0, 0.66, -0.14), 0, 0),
        part(new BoxGeometry(0.09, 0.4, 0.11).translate(-0.23, 0.6, -0.08), 0, 0),
        part(new BoxGeometry(0.09, 0.4, 0.11).translate(0.23, 0.6, -0.08), 0, 0),
        part(new IcosahedronGeometry(0.105, 1).translate(0, 1.03, -0.12), 1, 0),
        part(new BoxGeometry(0.34, 0.14, 0.42).translate(0, 0.44, 0.08), 0, 1),
        part(new BoxGeometry(0.3, 0.42, 0.12).translate(0, 0.21, 0.29), 0, 1),
      ]
    : [
        part(new BoxGeometry(0.38, 0.58, 0.24).translate(0, 1.12, 0), 0, 0),
        part(new BoxGeometry(0.09, 0.56, 0.11).translate(-0.24, 1.06, 0), 0, 0),
        part(new BoxGeometry(0.09, 0.56, 0.11).translate(0.24, 1.06, 0), 0, 0),
        part(new IcosahedronGeometry(0.11, 1).translate(0, 1.57, 0), 1, 0),
        part(new BoxGeometry(0.32, 0.84, 0.2).translate(0, 0.42, 0), 0, 1),
      ]
  const g = mergeGeometries(parts)!
  return g
}

/** Pessoas: camisa (cor da instância), calça escura e rosto em tom de pele. */
function createPeopleMaterial() {
  const material = new MeshLambertMaterial()
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSkin;\nattribute float aPants;\nattribute vec3 aSkinTone;\nvarying vec3 vPersonColor;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          vPersonColor = mix(mix(instanceColor.rgb, vec3(0.05, 0.055, 0.07), aPants), aSkinTone, aSkin);
        #endif`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPersonColor;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vPersonColor;')
  }
  material.customProgramCacheKey = () => 'skybox-people'
  return withBoxLight(material, 'people', 3.2)
}

/**
 * Vidro do camarote: na moldura do camarote sob o cursor (ou aberto) acende
 * uma borda laranja. Um painel por camarote, na ordem dos índices.
 */
function createGlassMaterial() {
  const material = new MeshStandardMaterial({
    color: '#a9c2d6',
    roughness: 0.04,
    metalness: 0.1,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    envMapIntensity: 1.6,
  })
  const w = INNER_WIDTH
  const h = SKYBOX.ceiling - SKYBOX.floor
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, selectionUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGlassBox;\nvarying vec2 vGlassUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlassBox = float(gl_InstanceID);\nvGlassUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying float vGlassBox;\nvarying vec2 vGlassUv;\n${SELECTION_HEADER}\n${SELECTION_FUNCTIONS}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float glow = max(selIs(vGlassBox, uHoverBox), selIs(vGlassBox, uSelectBox) * (0.75 + 0.25 * uPulse));
          vec2 toEdge = min(vGlassUv, 1.0 - vGlassUv) * vec2(${w.toFixed(2)}, ${h.toFixed(2)});
          float edge = 1.0 - smoothstep(0.03, 0.13, min(toEdge.x, toEdge.y));
          totalEmissiveRadiance += ${HIGHLIGHT_LINEAR} * glow * (edge * 2.4 + 0.1);
          diffuseColor.a = mix(diffuseColor.a, 1.0, glow * edge);
        }`,
      )
  }
  material.customProgramCacheKey = () => 'skybox-glass'
  return material
}

/** Faixa de LED no peitoril: azul se o camarote está livre, vermelha se vendido, laranja no destaque. */
function createSillMaterial() {
  const material = new MeshBasicMaterial()
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, selectionUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying float vSillHl;\n${SELECTION_HEADER}\n${SELECTION_FUNCTIONS}`)
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSillHl = max(selIs(float(gl_InstanceID), uHoverBox), selIs(float(gl_InstanceID), uSelectBox));',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSillHl;')
      .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, ${HIGHLIGHT_LINEAR}, vSillHl) * 2.2;`)
  }
  material.customProgramCacheKey = () => 'skybox-sill'
  return material
}

/** Placa com o número: cada instância lê o seu quadro do atlas. */
function createNumberMaterial(map: MeshBasicMaterial['map']) {
  const material = new MeshLambertMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.9 })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      {
        float tile = float(gl_InstanceID);
        vec2 cell = vec2(mod(tile, ${NUMBER_COLUMNS.toFixed(1)}), ${(NUMBER_ROWS - 1).toFixed(1)} - floor(tile / ${NUMBER_COLUMNS.toFixed(1)}));
        vMapUv = (uv + cell) / vec2(${NUMBER_COLUMNS.toFixed(1)}, ${NUMBER_ROWS.toFixed(1)});
        vEmissiveMapUv = vMapUv;
      }`,
    )
  }
  material.customProgramCacheKey = () => 'skybox-number'
  return material
}

const getSkyboxParts = once(() => {
  const { front, floor, ceiling, back } = SKYBOX
  const [, r1, r2] = SKYBOX.rows
  const boxes = getSkyboxes()

  const shell = new SweepBuilder()
    .around(
      profile([
        [20.3, floor - 0.4, '#5d5f63'],
        [20.3, floor, '#4a4038'],
        [r1[0] - 0.55, floor, '#3d332c'],
        [r1[0] - 0.55, r1[1], '#4a4038'],
        [r2[0] - 0.55, r1[1], '#3d332c'],
        [r2[0] - 0.55, r2[1], '#4a4038'],
        [back, r2[1], '#5d5f63'],
        [back, floor - 0.4, '#5d5f63'],
      ]),
      SKYBOX_SEGMENTS,
    )
    .around(
      profile([
        [back - 0.3, r2[1], '#3a2418'],
        [back - 0.3, ceiling, '#3a2418'],
        [back, ceiling, '#3a2418'],
        [back, r2[1], '#3a2418'],
      ]),
      SKYBOX_SEGMENTS,
    )
    .around(
      profile([
        [20.3, floor, '#2c2f35'],
        [20.3, ceiling, '#2c2f35'],
        [front, ceiling, '#2c2f35'],
        [front, floor, '#2c2f35'],
      ]),
      OTHER_SEGMENTS,
    )
    .build()

  const frameOf = (segment: number, s: number, d: number): Frame => frameAt(SEGMENTS[segment], s, d)
  const lineLength = (segment: number) => {
    const seg = SEGMENTS[segment]
    return seg.kind === 'line' ? seg.length : 1
  }

  const partitions: Frame[] = []
  const mullions: Frame[] = []
  const lights: Frame[] = []
  for (const segment of SKYBOX_SEGMENTS) {
    const count = boxes.filter((b) => b.segment === segment).length
    for (let k = 0; k <= count; k++) partitions.push(frameOf(segment, k / count, (front + back) / 2))
  }

  // matrizes por camarote: poltronas, pessoas, balcão, parede do fundo, placa, vidro e peitoril
  const rand = mulberry32(31)
  const chairs: Matrix4[] = []
  const seated: { matrix: Matrix4; box: number }[] = []
  const standing: { matrix: Matrix4; box: number }[] = []
  const perBox = { counter: [] as Matrix4[], wall: [] as Matrix4[], sign: [] as Matrix4[], glass: [] as Matrix4[], sill: [] as Matrix4[] }
  const turn = new Matrix4().makeRotationY(Math.PI)
  for (const box of boxes) {
    const len = lineLength(box.segment)
    const at = (offset: number, d: number) => frameOf(box.segment, box.center + offset / len, d)
    SKYBOX.rows.forEach(([d, y]) => {
      for (let j = 0; j < SKYBOX.chairsPerRow; j++) {
        const matrix = frameMatrix(at((j - (SKYBOX.chairsPerRow - 1) / 2) * CHAIR_SPACING, d), y, new Matrix4())
        chairs.push(matrix)
        if (box.sold && rand() < 0.62) seated.push({ matrix, box: box.index })
      }
    })
    if (box.sold) {
      for (const offset of [-0.9, 0.5, 1.2]) {
        // de frente para o balcão
        if (rand() < 0.75) standing.push({ matrix: frameMatrix(at(offset, COUNTER_D - 0.7), TOP_FLOOR, new Matrix4(), turn), box: box.index })
      }
    }
    perBox.counter.push(frameMatrix(at(0, COUNTER_D), TOP_FLOOR, new Matrix4()))
    perBox.wall.push(frameMatrix(at(0, WALL_D), TOP_FLOOR + 1.71, new Matrix4()))
    perBox.sign.push(frameMatrix(at(0, WALL_D - 0.02), 14.6, new Matrix4()))
    perBox.glass.push(frameMatrix(at(0, front), (floor + ceiling) / 2, new Matrix4()))
    perBox.sill.push(frameMatrix(at(0, front - 0.07), floor + 0.05, new Matrix4()))
    lights.push(at(0, 22.4), at(0, 25.2))
    // vidro em três vãos, sem caixilho no meio (a placa do número fica à vista)
    for (const offset of [-INNER_WIDTH / 6, INNER_WIDTH / 6]) mullions.push(at(offset, front + 0.04))
  }

  const wallArt = createSkyboxWallTextures()
  const numbers = createSkyboxNumbers()
  const rand2 = mulberry32(5)
  const shirts = ['#c8102e', '#1d4ed8', '#f2f2f0', '#1b1d22', '#6b7280', '#c8102e', '#1d4ed8'].map((c) => new Color(c))
  const skins = ['#f1c7a4', '#d9a37c', '#a8714d', '#6f4529', '#4a2c1c'].map((c) => new Color(c))
  const personColors = (count: number) => {
    const shirt = new Float32Array(count * 3)
    const skin = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      shirts[Math.floor(rand2() * shirts.length)].toArray(shirt, i * 3)
      skins[Math.floor(rand2() * skins.length)].toArray(skin, i * 3)
    }
    return { shirt, skin }
  }

  return {
    shell,
    partitions,
    mullions,
    lights,
    perBox,
    wallArt,
    numbers,
    sides: splitBySide(boxes.length, chairs, seated, standing, personColors(seated.length), personColors(standing.length)),
    sillColors: Float32Array.from(
      boxes.flatMap((b) => new Color(b.sold ? SEAT_COLORS.taken : SEAT_COLORS.available).toArray()),
    ),
    shellMaterial: withBoxLight(
      withSurfaceNoise(new MeshLambertMaterial({ vertexColors: true }), 'skybox', { strength: 0.1, fill: 0.35 }),
      'shell',
      2.6,
    ),
    glassMaterial: createGlassMaterial(),
    wallMaterial: withBoxLight(new MeshLambertMaterial({ color: '#6b4a34' }), 'walls', 1.8),
    frameMaterial: new MeshLambertMaterial({ color: '#2a2d33' }),
    leather: withBoxLight(new MeshLambertMaterial({ color: '#5a3424' }), 'leather', 3.2),
    counterMaterial: withBoxLight(new MeshLambertMaterial({ vertexColors: true }), 'counter', 2.6),
    artMaterial: withBoxLight(
      new MeshLambertMaterial({ map: wallArt.map, emissiveMap: wallArt.glow, emissive: '#ffffff', emissiveIntensity: 1.5 }),
      'art',
      1.6,
    ),
    numberMaterial: createNumberMaterial(numbers.texture),
    peopleMaterial: createPeopleMaterial(),
    sillMaterial: createSillMaterial(),
    lightMaterial: new MeshLambertMaterial({ color: '#fff', emissive: '#ffd39b', emissiveIntensity: 4 }),
    partitionGeometry: new BoxGeometry(0.16, ceiling - floor, back - front).translate(0, (ceiling - floor) / 2, 0),
    mullionGeometry: new BoxGeometry(0.07, ceiling - floor, 0.1).translate(0, (ceiling - floor) / 2, 0),
    chairGeometry: createArmchairGeometry(),
    chairFarGeometry: createArmchairGeometry(false),
    counterGeometry: createCounterGeometry(),
    wallGeometry: new PlaneGeometry(INNER_WIDTH - 0.1, ceiling - TOP_FLOOR - 0.08),
    signGeometry: new PlaneGeometry(1.5, 0.28),
    glassGeometry: new PlaneGeometry(INNER_WIDTH, ceiling - floor),
    sillGeometry: new BoxGeometry(INNER_WIDTH - 0.2, 0.05, 0.05),
    lightGeometry: new BoxGeometry(5.6, 0.05, 0.35),
  }
})

type Placed = { matrix: Matrix4; box: number }
type Colors = { shirt: Float32Array; skin: Float32Array }

/**
 * Poltronas e pessoas separadas por lateral (norte e sul): de dentro do
 * estádio a câmera enquadra um lado só, e a placa de vídeo descarta o outro.
 * Cada lado tem a própria geometria de pessoa (o tom de pele é um atributo dela).
 */
function splitBySide(total: number, chairs: Matrix4[], seated: Placed[], standing: Placed[], seatedColors: Colors, standingColors: Colors) {
  const half = total / 2
  const perBox = SKYBOX.rows.length * SKYBOX.chairsPerRow
  const pick = (values: Float32Array, indices: number[]) => Float32Array.from(indices.flatMap((i) => [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]]))
  return [0, 1].map((side) => {
    const inSide = (box: number) => (box < half) === (side === 0)
    const seatedIdx = seated.flatMap((p, i) => (inSide(p.box) ? [i] : []))
    const standingIdx = standing.flatMap((p, i) => (inSide(p.box) ? [i] : []))
    return {
      chairs: chairs.filter((_, i) => inSide(Math.floor(i / perBox))),
      seated: seatedIdx.map((i) => seated[i].matrix),
      seatedColors: { shirt: pick(seatedColors.shirt, seatedIdx), skin: pick(seatedColors.skin, seatedIdx) },
      seatedGeometry: createPersonGeometry(true),
      standing: standingIdx.map((i) => standing[i].matrix),
      standingColors: { shirt: pick(standingColors.shirt, standingIdx), skin: pick(standingColors.skin, standingIdx) },
      standingGeometry: createPersonGeometry(false),
    }
  })
}

/** Balcão do bar: corpo escuro, tampo claro e um filete de LED quente embaixo do tampo. */
function createCounterGeometry(): BufferGeometry {
  const colored = (g: BufferGeometry, hex: string) => {
    const flat = g.toNonIndexed()
    flat.deleteAttribute('uv')
    const c = new Color(hex)
    const n = flat.getAttribute('position').count
    flat.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3))
    return flat
  }
  return mergeGeometries([
    colored(new BoxGeometry(3.4, 1.0, 0.5).translate(0, 0.5, 0), '#1c1d21'),
    colored(new BoxGeometry(3.6, 0.05, 0.66).translate(0, 1.025, 0.02), '#d8d2c6'),
    colored(new BoxGeometry(3.3, 0.03, 0.02).translate(0, 0.96, 0.27), '#ffd8a8'),
  ])!
}

function Instances({
  matrices,
  geometry,
  material,
  colors,
  skin,
}: {
  matrices: Matrix4[]
  geometry: BufferGeometry
  material: Material
  colors?: Float32Array
  skin?: Float32Array
}) {
  const ref = useRef<InstancedMesh>(null)
  useEffect(() => {
    const mesh = ref.current!
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    if (colors) mesh.instanceColor = new InstancedBufferAttribute(colors, 3)
    if (skin) geometry.setAttribute('aSkinTone', new InstancedBufferAttribute(skin, 3))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices, colors, skin, geometry])
  if (matrices.length === 0) return null
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} />
}

export function Skyboxes() {
  const parts = useMemo(() => getSkyboxParts(), [])
  const group = useRef<Group>(null)
  const roundChairs = useRef<Group>(null)
  const boxChairs = useRef<Group>(null)

  useEffect(() => {
    // redesenha os textos quando a fonte terminar de carregar
    document.fonts?.ready.then(() => {
      const { wallArt, numbers } = getSkyboxParts()
      wallArt.redraw()
      numbers.redraw()
    })
  }, [])

  useFrame((state) => {
    const camera = state.camera.position
    const visible = camera.length() < VISIBLE_WITHIN
    if (group.current) group.current.visible = visible
    if (!visible || !roundChairs.current || !boxChairs.current) return
    let closest = Infinity
    for (const box of getSkyboxes()) {
      const [x, y, z] = box.position
      closest = Math.min(closest, Math.hypot(camera.x - x, camera.y - y, camera.z - z))
    }
    roundChairs.current.visible = closest < ROUNDED_WITHIN
    boxChairs.current.visible = closest >= ROUNDED_WITHIN
  })

  return (
    <group ref={group}>
      <mesh geometry={parts.shell} material={parts.shellMaterial} />
      <FrameInstances frames={parts.partitions} y={SKYBOX.floor} geometry={parts.partitionGeometry} material={parts.wallMaterial} />
      <FrameInstances frames={parts.mullions} y={SKYBOX.floor} geometry={parts.mullionGeometry} material={parts.frameMaterial} />
      <FrameInstances frames={parts.lights} y={SKYBOX.ceiling - 0.04} geometry={parts.lightGeometry} material={parts.lightMaterial} />
      <group ref={roundChairs}>
        {parts.sides.map((side, i) => (
          <Instances key={i} matrices={side.chairs} geometry={parts.chairGeometry} material={parts.leather} />
        ))}
      </group>
      <group ref={boxChairs}>
        {parts.sides.map((side, i) => (
          <Instances key={i} matrices={side.chairs} geometry={parts.chairFarGeometry} material={parts.leather} />
        ))}
      </group>
      {parts.sides.map((side, i) => (
        <group key={i}>
          <Instances
            matrices={side.seated}
            geometry={side.seatedGeometry}
            material={parts.peopleMaterial}
            colors={side.seatedColors.shirt}
            skin={side.seatedColors.skin}
          />
          <Instances
            matrices={side.standing}
            geometry={side.standingGeometry}
            material={parts.peopleMaterial}
            colors={side.standingColors.shirt}
            skin={side.standingColors.skin}
          />
        </group>
      ))}
      <Instances matrices={parts.perBox.counter} geometry={parts.counterGeometry} material={parts.counterMaterial} />
      <Instances matrices={parts.perBox.wall} geometry={parts.wallGeometry} material={parts.artMaterial} />
      <Instances matrices={parts.perBox.sign} geometry={parts.signGeometry} material={parts.numberMaterial} />
      <Instances matrices={parts.perBox.sill} geometry={parts.sillGeometry} material={parts.sillMaterial} colors={parts.sillColors} />
      <Instances matrices={parts.perBox.glass} geometry={parts.glassGeometry} material={parts.glassMaterial} />
    </group>
  )
}
