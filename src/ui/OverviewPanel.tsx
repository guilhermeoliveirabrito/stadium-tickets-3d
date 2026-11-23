import { useMemo } from 'react'
import { getLayout } from '../lib/layout'

const canHover = window.matchMedia('(hover: hover)').matches

const number = new Intl.NumberFormat('pt-BR')

export function OverviewPanel({ visible }: { visible: boolean }) {
  const stats = useMemo(() => {
    const { blocks, seats } = getLayout()
    const available = blocks.reduce((n, b) => n + b.available, 0)
    return { seats: seats.count, available, blocks: blocks.length }
  }, [])

  return (
    <section className="panel glass" data-visible={visible} aria-label="Visão geral do estádio" aria-hidden={!visible}>
      <p className="panel__kicker">Visão geral</p>
      <h2 className="panel__title">Escolha seu setor</h2>
      <p className="panel__text">Três anéis, camarotes e vista para o campo inteiro. Os lugares em azul ainda estão livres.</p>
      <ul className="legend">
        <li>
          <span className="legend__dot" style={{ background: 'var(--seat-blue)' }} />
          Disponível
        </li>
        <li>
          <span className="legend__dot" style={{ background: 'var(--seat-red)' }} />
          Ocupado
        </li>
      </ul>
      <p className="hint">
        <span className="hint__icon" aria-hidden="true" />
        {canHover ? 'Passe o mouse sobre um bloco para ver o preço e clique para ver de perto.' : 'Toque em um bloco para ver de perto.'}
      </p>
      <dl className="stats">
        <div>
          <dt>Lugares</dt>
          <dd>{number.format(stats.seats)}</dd>
        </div>
        <div>
          <dt>Disponíveis</dt>
          <dd>{number.format(stats.available)}</dd>
        </div>
        <div>
          <dt>Blocos</dt>
          <dd>{stats.blocks}</dd>
        </div>
      </dl>
    </section>
  )
}
