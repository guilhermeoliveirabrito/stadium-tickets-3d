import { useMemo } from 'react'
import { getLayout } from '../lib/layout'

const number = new Intl.NumberFormat('pt-BR')

export function OverviewPanel({ visible }: { visible: boolean }) {
  const stats = useMemo(() => {
    const { blocks, seats } = getLayout()
    const available = blocks.reduce((n, b) => n + b.available, 0)
    return { seats: seats.count, available, blocks: blocks.length }
  }, [])

  return (
    <section className="panel glass" data-visible={visible} aria-label="Visão geral do estádio">
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
