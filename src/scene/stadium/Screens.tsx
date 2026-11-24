import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, type CanvasTexture, Color, Matrix4, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EVENT } from '../../config/event'
import { BOWL, ROOF } from '../../config/stadium'
import { formatSkybox, getSkyboxes } from '../../lib/skyboxes'
import { seatLabel } from '../../lib/blocks'
import { getLayout } from '../../lib/layout'
import { once } from '../../lib/once'
import { canvasTexture } from '../../lib/textures'
import { useExperience } from '../../store/experience'
import { drawGithub, LED_FONT } from './ledContent'

const WIDTH = 28
const HEIGHT = 11.5
/** inclinação para trás: de baixo (arquibancadas) e de cima (visão geral) dá para ler */
const TILT = 0.6
// Os desenhos usam coordenadas de 1152 x 480 e são reduzidos para o canvas
// real: os telões aparecem pequenos na tela e não precisam de mais resolução.
const CANVAS_W = 1152
const CANVAS_H = 480
const SCALE = 2 / 3

type Slide = 'score' | 'pick' | 'arena' | 'github'

/** quanto tempo (s) cada telão fica em cada tela */
const SCORE_SECONDS = 22
const EXTRA_SECONDS = 8
/** o GitHub aparece de vez em quando: a cada tantos ciclos */
const GITHUB_EVERY = 3

const HOME = '#c8102e'
const AWAY = '#1d4ed8'

function background(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0c1226')
  g.addColorStop(1, '#050811')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // faixa de cor dos dois times no rodapé
  ctx.fillStyle = HOME
  ctx.fillRect(0, h - 10, w / 2, 10)
  ctx.fillStyle = AWAY
  ctx.fillRect(w / 2, h - 10, w / 2, 10)
}

/** Texto centralizado; encolhe se passar de `maxWidth` (o padrão é quase a largura da tela). */
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
  tracking = 0,
  maxWidth = CANVAS_W * 0.9,
) {
  ctx.font = `${weight} ${size}px ${LED_FONT}`
  ctx.letterSpacing = `${tracking}px`
  const width = ctx.measureText(value).width
  if (width > maxWidth) {
    size *= maxWidth / width
    tracking *= maxWidth / width
    ctx.font = `${weight} ${size}px ${LED_FONT}`
  }
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = `${tracking}px`
  ctx.fillText(value, x, y)
  ctx.letterSpacing = '0px'
}

function crest(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, label: string) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = r * 0.12
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.stroke()
  text(ctx, label, x, y + r * 0.04, r * 0.62, 800, '#fff', 1)
}

/** Dia do calendário no horário de Brasília (UTC-3), contado a partir de 1970. */
const brasiliaDay = (ms: number) => Math.floor((ms - 3 * 3600000) / 86400000)

/** Dias até o jogo pelo calendário (só os dias: o placar não precisa ser redesenhado a cada segundo); -1 depois do início. */
function daysLeft(now = Date.now()) {
  const kickoff = Date.parse(EVENT.kickoff)
  return now >= kickoff ? -1 : brasiliaDay(kickoff) - brasiliaDay(now)
}

function countdown(days: number) {
  if (days < 0) return 'BOLA ROLANDO'
  if (days === 0) return 'É HOJE'
  return days === 1 ? 'FALTA 1 DIA' : `FALTAM ${days} DIAS`
}

function drawScore(ctx: CanvasRenderingContext2D, w: number, h: number, days: number) {
  background(ctx, w, h)
  text(ctx, `${EVENT.stage.toUpperCase()}  ·  ${EVENT.season.toUpperCase()}`, w / 2, h * 0.15, 30, 700, '#9fb0d9', 6)
  crest(ctx, w * 0.1, h * 0.5, 66, HOME, EVENT.home.short)
  crest(ctx, w * 0.9, h * 0.5, 66, AWAY, EVENT.away.short)
  text(ctx, EVENT.home.short, w * 0.27, h * 0.5, 92, 800, '#fff', 4)
  text(ctx, '0', w * 0.42, h * 0.5, 112, 800, '#fff')
  text(ctx, '×', w * 0.5, h * 0.49, 64, 500, '#7f8bab')
  text(ctx, '0', w * 0.58, h * 0.5, 112, 800, '#fff')
  text(ctx, EVENT.away.short, w * 0.73, h * 0.5, 92, 800, '#fff', 4)
  text(ctx, countdown(days), w / 2, h * 0.83, 42, 700, '#ffb28f', 6)
}

function drawPick(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, detail: string) {
  background(ctx, w, h)
  text(ctx, title, w / 2, h * 0.2, 34, 700, '#9fb0d9', 8)
  text(ctx, detail, w / 2, h * 0.5, 76, 800, '#fff', 2)
  text(ctx, 'TE VEMOS NA FINAL!', w / 2, h * 0.79, 46, 800, '#ffb28f', 6)
}

function drawArena(ctx: CanvasRenderingContext2D, w: number, h: number) {
  background(ctx, w, h)
  text(ctx, 'BEM-VINDO À', w / 2, h * 0.27, 38, 700, '#9fb0d9', 10)
  text(ctx, EVENT.stadium.toUpperCase(), w / 2, h * 0.52, 110, 800, '#fff', 10)
  text(ctx, `${EVENT.date.toUpperCase()}  ·  ${EVENT.time}`, w / 2, h * 0.78, 36, 700, '#ffb28f', 6)
}

function drawGithubAd(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#0d1117')
  g.addColorStop(1, '#161b2e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  text(ctx, 'CONHEÇA O AUTOR DESTE PROJETO', w / 2, h * 0.24, 30, 700, '#8b96a8', 8)
  drawGithub(ctx, w / 2, h * 0.52, 66, w * 0.86, '#ffffff', '#9aa4b2')
  ctx.fillStyle = '#ff5a1f'
  ctx.fillRect(w * 0.4, h * 0.74, w * 0.2, 6)
}

/** O que mostrar na tela "sua escolha": a cadeira escolhida ou o que foi comprado. */
function pickText() {
  const { selectedSeat, order } = useExperience.getState()
  const seat = selectedSeat >= 0 ? selectedSeat : order?.kind === 'seat' ? order.seat : -1
  if (seat >= 0) {
    const { seats, blocks } = getLayout()
    const label = seatLabel(seat)
    const bought = order?.kind === 'seat' && order.seat === seat
    return {
      title: bought ? 'SEU INGRESSO' : 'SUA CADEIRA',
      detail: `BLOCO ${blocks[seats.block[seat]].number}  ·  FILEIRA ${label.row}  ·  CADEIRA ${label.number}`,
    }
  }
  if (order?.kind === 'box') return { title: 'SEU CAMAROTE', detail: formatSkybox(getSkyboxes()[order.box]).toUpperCase() }
  return null
}

/** Telão: moldura, pernas e a tela, montados de frente para -x (lado leste) e espelhados no oeste. */
function createScreenParts() {
  const frame = mergeGeometries([
    new BoxGeometry(0.8, HEIGHT + 0.7, WIDTH + 0.7).translate(0.45, 0, 0),
    new BoxGeometry(0.5, 7, 0.5).translate(2.2, -2.6, -WIDTH * 0.32),
    new BoxGeometry(0.5, 7, 0.5).translate(2.2, -2.6, WIDTH * 0.32),
  ])!
  const screen = new PlaneGeometry(WIDTH, HEIGHT).rotateY(-Math.PI / 2)
  // tela também do lado de fora, para quem chega ao estádio (e na abertura)
  const back = new PlaneGeometry(WIDTH, HEIGHT).rotateY(Math.PI / 2).translate(0.86, 0, 0)
  return { frame, screen: mergeGeometries([screen, back])! }
}

const getScreens = once(() => {
  const { frame, screen } = createScreenParts()
  // de pé na borda interna da cobertura, inclinado para trás
  const edge = BOWL.halfX + ROOF.inner + 1.2
  const base = ROOF.innerY + 0.3
  // o do oeste é o do leste girado meia volta (espelhado, o texto ficaria ao contrário)
  const placements = [1, -1].map((side) =>
    new Matrix4()
      .makeTranslation(side * (edge + (Math.sin(TILT) * HEIGHT) / 2), base + (Math.cos(TILT) * HEIGHT) / 2, 0)
      .multiply(new Matrix4().makeRotationY(side > 0 ? 0 : Math.PI))
      .multiply(new Matrix4().makeRotationZ(-TILT)),
  )
  return {
    frames: mergeGeometries(placements.map((m) => frame.clone().applyMatrix4(m)))!,
    screens: mergeGeometries(placements.map((m) => screen.clone().applyMatrix4(m)))!,
    frameMaterial: new MeshLambertMaterial({ color: '#1b1e24' }),
    // já nasce com a textura do placar: trocar de "sem textura" para "com
    // textura" obrigaria a recompilar o shader no meio da animação
    screenMaterial: new MeshBasicMaterial({ color: new Color(1.25, 1.25, 1.25), map: scoreTexture('f0') }),
  }
})

/** Uma textura por tela, desenhada uma vez só (e de novo só se o conteúdo mudar). */
const slides = new Map<Slide, { texture: CanvasTexture; key: string }>()

function scoreTexture(fonts: string) {
  const days = daysLeft()
  return slideTexture('score', `${fonts}${days}`, (ctx, w, h) => drawScore(ctx, w, h, days))
}

/** Textura de uma tela; só é redesenhada quando `key` (o conteúdo) muda. */
function slideTexture(slide: Slide, key: string, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  let entry = slides.get(slide)
  if (!entry) {
    entry = { texture: canvasTexture(CANVAS_W * SCALE, CANVAS_H * SCALE, () => {}, { anisotropy: 8 }), key: '' }
    slides.set(slide, entry)
  }
  if (entry.key !== key) {
    const canvas = entry.texture.image as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    draw(ctx, CANVAS_W, CANVAS_H)
    entry.texture.needsUpdate = true
    entry.key = key
  }
  return entry.texture
}

/** Dois telões atrás dos gols: placar com os dias até o jogo, a escolha da pessoa e, de vez em quando, o GitHub do autor. */
export function Screens() {
  const parts = useMemo(() => getScreens(), [])
  // a última escolha fica guardada: o telão continua mostrando a cadeira (ou o
  // camarote) depois que a pessoa volta para o setor ou para a visão geral
  const ref = useRef({
    slide: '' as Slide | '',
    since: 0,
    cycle: 0,
    pick: null as { title: string; detail: string } | null,
    fonts: 0,
  })

  useEffect(() => {
    // redesenha as telas quando a fonte terminar de carregar
    document.fonts?.ready.then(() => {
      ref.current.fonts++
      ref.current.slide = ''
    })
  }, [])

  useFrame((frameState) => {
    const state = ref.current
    const t = frameState.clock.elapsedTime
    const current = pickText()
    const fresh = current && (current.title !== state.pick?.title || current.detail !== state.pick?.detail)
    if (fresh) state.pick = current
    const pick = state.pick
    let next: Slide = state.slide || 'score'
    // uma escolha nova aparece na hora
    if (fresh) next = 'pick'
    else if (state.slide === 'score' && t - state.since > SCORE_SECONDS) {
      state.cycle++
      next = state.cycle % GITHUB_EVERY === 0 ? 'github' : pick ? 'pick' : 'arena'
    } else if (state.slide && state.slide !== 'score' && t - state.since > EXTRA_SECONDS) next = 'score'
    if (next === state.slide && !fresh) return

    // troca de tela: só troca a textura (cada tela já está desenhada)
    if (next !== state.slide) state.since = t
    state.slide = next
    const fonts = `f${state.fonts}`
    const material = getScreens().screenMaterial
    if (next === 'score') {
      material.map = scoreTexture(fonts)
    } else if (next === 'pick' && pick) {
      material.map = slideTexture('pick', `${fonts}${pick.title}${pick.detail}`, (ctx, w, h) => drawPick(ctx, w, h, pick.title, pick.detail))
    } else if (next === 'github') {
      material.map = slideTexture('github', fonts, drawGithubAd)
    } else {
      material.map = slideTexture('arena', fonts, drawArena)
    }
  })

  return (
    <group>
      <mesh geometry={parts.frames} material={parts.frameMaterial} />
      <mesh geometry={parts.screens} material={parts.screenMaterial} />
    </group>
  )
}
