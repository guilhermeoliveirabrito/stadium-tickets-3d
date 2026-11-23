import { AUTHOR, AUTHOR_HOST } from '../../config/author'

export const LED_FONT = '"Inter Variable", system-ui, sans-serif'

// Marca do GitHub (octicon "mark-github", 16 x 16).
const GITHUB_MARK = new Path2D(
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z',
)

/**
 * Desenha a marca do GitHub e o endereço do perfil centralizados em (cx, cy),
 * com a altura de letra pedida, encolhendo se não couber em `maxWidth`.
 */
export function drawGithub(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  maxWidth: number,
  color: string,
  hostColor = color,
) {
  const measure = (s: number) => {
    ctx.font = `500 ${s}px ${LED_FONT}`
    const host = ctx.measureText(AUTHOR_HOST).width
    ctx.font = `800 ${s}px ${LED_FONT}`
    const name = ctx.measureText(AUTHOR.github).width
    const mark = s * 1.05
    const gap = s * 0.42
    return { host, name, mark, gap, total: mark + gap + host + name }
  }
  let m = measure(size)
  if (m.total > maxWidth) {
    size *= maxWidth / m.total
    m = measure(size)
  }
  let x = cx - m.total / 2
  ctx.save()
  ctx.fillStyle = color
  ctx.translate(x, cy - m.mark / 2)
  ctx.scale(m.mark / 16, m.mark / 16)
  ctx.fill(GITHUB_MARK)
  ctx.restore()
  x += m.mark + m.gap

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = '0px'
  ctx.font = `500 ${size}px ${LED_FONT}`
  ctx.fillStyle = hostColor
  ctx.fillText(AUTHOR_HOST, x, cy + size * 0.04)
  ctx.font = `800 ${size}px ${LED_FONT}`
  ctx.fillStyle = color
  ctx.fillText(AUTHOR.github, x + m.host, cy + size * 0.04)
}
