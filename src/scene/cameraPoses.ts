import { MathUtils } from 'three'
import { BOWL, ROOF, SKYBOX } from '../config/stadium'
import type { BlockInfo } from '../lib/blocks'
import { getLayout } from '../lib/layout'
import type { SkyboxInfo } from '../lib/skyboxes'

export interface Pose {
  az: number
  el: number
  dist: number
  tx: number
  ty: number
  tz: number
  fov: number
  /**
   * Desloca a imagem para cima (fração da altura da tela), sem mexer na
   * câmera. No celular em pé, o painel cobre a parte de baixo da tela e o
   * bloco precisa ficar centrado no espaço que sobra.
   */
  shift: number
  /**
   * 0 = vista de fora; 1 = câmera dentro do estádio (setor e bloco). Anda
   * junto com a câmera e fecha a neblina sobre a cidade (ver CameraRig).
   */
  inside: number
}

// Começa sobre o bairro do outro lado da avenida, com o estacionamento em
// primeiro plano e o skyline atrás do estádio, e contorna pelo sul.
export const INTRO_START: Pose = { az: -0.78, el: 0.1, dist: 480, tx: -30, ty: 22, tz: 0, fov: 40, shift: 0, inside: 0 }
export const INTRO_SWEEP: Partial<Pose> = { az: 0.45, el: 0.28, dist: 360, tx: -20, ty: 8 }

const emptyPose = (): Pose => ({ az: 0, el: 0, dist: 0, tx: 0, ty: 0, tz: 0, fov: 0, shift: 0, inside: 0 })

/** Tela estreita (celular em pé): o painel ocupa a parte de baixo. */
const isNarrow = (aspect: number) => aspect < 0.9
const NARROW_SHIFT = 0.2

/**
 * Abertura da cobertura, com folga: nas vistas de dentro a câmera nunca passa
 * daqui na horizontal. Mais longe ela sairia do estádio por cima da
 * cobertura do lado oposto (mostrando a borda dela e a fachada de fora).
 */
const OPENING = ROOF.inner - 10

/** O ponto (x, z) está dentro da abertura (retângulo de cantos arredondados paralelo ao contorno)? */
function insideOpening(x: number, z: number) {
  const r = BOWL.radius + OPENING
  const qx = Math.abs(x) - (BOWL.halfX + OPENING - r)
  const qz = Math.abs(z) - (BOWL.halfZ + OPENING - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r <= 0
}

/**
 * Se a câmera da pose ficaria fora da abertura da cobertura, aproxima a
 * câmera do alvo (mantendo o ângulo) até o ponto em que ela sai da abertura.
 */
function keepInside(out: Pose) {
  const cos = Math.cos(out.el)
  const horizontal = out.dist * cos
  const dx = Math.sin(out.az)
  const dz = Math.cos(out.az)
  if (insideOpening(out.tx + dx * horizontal, out.tz + dz * horizontal)) return out
  // ponto da reta mais perto do centro do estádio: está dentro da abertura
  let lo = Math.max(0, -(out.tx * dx + out.tz * dz))
  if (!insideOpening(out.tx + dx * lo, out.tz + dz * lo)) return out
  let hi = horizontal
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (insideOpening(out.tx + dx * mid, out.tz + dz * mid)) lo = mid
    else hi = mid
  }
  out.dist = lo / cos
  return out
}

/** Vista de cima, enquadrando o estádio e um pouco do parque em qualquer proporção de tela. */
/** `out` permite reaproveitar o mesmo objeto a cada quadro, sem gerar lixo para o coletor. */
export function aerialPose(aspect: number, out: Pose = emptyPose()): Pose {
  const fov = 32
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  // em telas largas a câmera vai um pouco para oeste, para o estacionamento
  // aparecer ao lado do estádio; em telas estreitas fica centrada no estádio
  const shift = Math.min(1, Math.max(0, (aspect - 0.8) / 0.4))
  out.az = 0
  out.el = 1.37
  out.dist = Math.max(202 / t, 160 / (t * aspect))
  out.tx = -46 * shift
  out.ty = 0
  out.tz = 16
  out.fov = fov
  // no celular em pé o estádio sobe para o espaço acima do painel
  out.shift = isNarrow(aspect) ? NARROW_SHIFT : 0
  out.inside = 0
  return out
}

/** Ângulo (az) de quem olha do campo para o bloco: a câmera fica atrás do campo, de frente para a arquibancada. */
function facing(info: BlockInfo) {
  const [nx, nz] = info.normal
  return Math.atan2(-nx, -nz)
}

/**
 * Setor escolhido: a câmera desce sobre o campo e olha para a arquibancada de
 * cima, com o bloco no centro, os vizinhos dos lados e a beira do gramado.
 */
export function sectorPose(info: BlockInfo, aspect: number, out: Pose = emptyPose()): Pose {
  const fov = 36
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  const [x, y, z] = info.center
  // Uns oito blocos de largura e a altura da arquibancada inteira, com folga.
  // No celular em pé, o bloco e os vizinhos: enquadrar oito blocos numa tela
  // estreita levava a câmera para fora do estádio e deixava os setores pequenos.
  const narrow = isNarrow(aspect)
  const span = narrow ? Math.max(info.width * 3.4, 42) : Math.max(info.width * 8, 100)
  out.az = facing(info)
  out.el = 0.42
  out.dist = MathUtils.clamp(Math.max(span / 2 / (t * aspect), (narrow ? 30 : 46) / t), narrow ? 70 : 110, 240)
  out.tx = x
  // no celular o bloco fica no meio do espaço entre o topo da tela e o painel
  out.ty = narrow ? y : y * 0.6
  out.tz = z
  out.fov = fov
  out.shift = narrow ? 0.16 : 0
  out.inside = 1
  return keepInside(out)
}

/**
 * Vista de frente do bloco, quase na altura das fileiras do meio, para
 * escolher a cadeira. O bloco ocupa a maior parte da tela.
 */
export function blockPose(info: BlockInfo, aspect: number, out: Pose = emptyPose()): Pose {
  const fov = 34
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  const [x, y, z] = info.center
  // no celular em pé o bloco ocupa quase toda a largura e fica no espaço acima do painel
  const narrow = isNarrow(aspect)
  const fitWidth = (info.width * (narrow ? 1.08 : 1.28)) / 2 / (t * aspect)
  const fitHeight = (info.height * (narrow ? 2.6 : 1.7)) / 2 / t
  out.az = facing(info)
  out.el = 0.24
  out.dist = Math.max(fitWidth, fitHeight, 18)
  out.tx = x
  out.ty = y - info.height * 0.02
  out.tz = z
  out.fov = fov
  out.shift = narrow ? NARROW_SHIFT : 0
  out.inside = 1
  return keepInside(out)
}

/**
 * Camarote: de frente para o vidro, quase na altura do piso de cima, vendo as
 * poltronas, o balcão e a parede do fundo; os vizinhos aparecem nas bordas.
 */
export function boxPose(box: SkyboxInfo, aspect: number, out: Pose = emptyPose()): Pose {
  const fov = 34
  const t = Math.tan(MathUtils.degToRad(fov / 2))
  const [x, y, z] = box.position
  const [nx, nz] = box.normal
  const narrow = isNarrow(aspect)
  const height = SKYBOX.ceiling - SKYBOX.floor
  const fitWidth = (SKYBOX.width * (narrow ? 1.06 : 1.75)) / 2 / (t * aspect)
  const fitHeight = (height * (narrow ? 2.4 : 2.1)) / 2 / t
  out.az = Math.atan2(-nx, -nz)
  out.el = 0.09
  out.dist = Math.max(fitWidth, fitHeight)
  // alvo um pouco para dentro do camarote, para o fundo também caber
  out.tx = x + nx * 0.6
  out.ty = y - 0.15
  out.tz = z + nz * 0.6
  out.fov = fov
  out.shift = narrow ? NARROW_SHIFT : 0
  out.inside = 1
  return keepInside(out)
}

/**
 * Zoom na cadeira escolhida: de frente para ela, um pouco acima, com as
 * vizinhas em volta. A frente da cadeira (virada para o campo) é o rumo dela.
 */
export function seatPose(seat: number, aspect: number, out: Pose = emptyPose()): Pose {
  const { seats } = getLayout()
  const narrow = isNarrow(aspect)
  out.az = seats.yaw[seat]
  out.el = 0.42
  out.dist = narrow ? 5.4 : 3.8
  out.tx = seats.position[seat * 3]
  out.ty = seats.position[seat * 3 + 1] + 0.62
  out.tz = seats.position[seat * 3 + 2]
  out.fov = 40
  out.shift = narrow ? NARROW_SHIFT : 0
  out.inside = 1
  return out
}

/** Câmera em primeira pessoa: posição, rumo (como o das cadeiras), inclinação e abertura vertical. */
export interface Eye {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  fov: number
}

/** abertura horizontal da vista do lugar (graus): a vertical se ajusta à tela */
export const POV_HFOV = 75

/** Abertura vertical (graus) que dá a abertura horizontal da vista do lugar numa tela com esta proporção. */
export function povFov(aspect: number) {
  // em pé, a abertura vertical cresce para a horizontal não ficar estreita demais
  const vertical = 2 * Math.atan(Math.tan(MathUtils.degToRad(POV_HFOV / 2)) / aspect)
  return MathUtils.clamp(MathUtils.radToDeg(vertical), 50, 95)
}

const emptyEye = (): Eye => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 0 })

/** Olhar do ponto (x, y, z) para o campo, mirando a altura `aimY` no meio dele. */
function lookAtPitch(out: Eye, aimY: number) {
  out.yaw = Math.atan2(-out.x, -out.z)
  out.pitch = Math.atan2(aimY - out.y, Math.hypot(out.x, out.z))
}

/**
 * Vista de quem senta na cadeira: olhos a 1,2 m do piso, um pouco para trás
 * do centro do assento, olhando para o meio do campo.
 */
export function seatEye(seat: number, aspect: number, out: Eye = emptyEye()): Eye {
  const { seats } = getLayout()
  const yaw = seats.yaw[seat]
  out.x = seats.position[seat * 3] - Math.sin(yaw) * 0.08
  out.y = seats.position[seat * 3 + 1] + 1.22
  out.z = seats.position[seat * 3 + 2] - Math.cos(yaw) * 0.08
  lookAtPitch(out, 0.5)
  out.fov = povFov(aspect)
  return out
}

/**
 * Vista do camarote: sentado na primeira fileira de poltronas, no meio do
 * camarote, logo atrás do vidro. Mira um pouco acima do gramado, para pegar
 * também as arquibancadas do outro lado.
 */
export function boxEye(box: SkyboxInfo, aspect: number, out: Eye = emptyEye()): Eye {
  const [rowD, floor] = SKYBOX.rows[0]
  const [nx, nz] = box.normal
  // box.position fica no meio da profundidade; a primeira fileira está mais perto do vidro
  const delta = rowD + 0.05 - (SKYBOX.front + SKYBOX.back) / 2
  out.x = box.position[0] + nx * delta
  out.y = floor + 1.2
  out.z = box.position[2] + nz * delta
  lookAtPitch(out, 4)
  out.fov = povFov(aspect)
  return out
}
