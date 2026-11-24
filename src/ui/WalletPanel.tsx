import { formatPrice } from '../lib/blocks'
import { type Order, useExperience } from '../store/experience'
import { Chevron, CloseIcon, EyeIcon, TicketIcon } from './icons'
import { TicketCard } from './TicketCard'
import { useOrderShot } from './useOrderShot'
import { describeItem } from './ticketInfo'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function WalletItem({ order, onOpen, tab }: { order: Order; onOpen: () => void; tab: number }) {
  const describe = describeItem(order)
  const shot = useOrderShot(order)
  return (
    <li>
      <button className="wallet__item" type="button" onClick={onOpen} tabIndex={tab}>
        <span className="wallet__thumb">{shot ? <img src={shot} alt="" /> : <TicketIcon />}</span>
        <span className="wallet__text">
          <span className="wallet__title">{describe.title}</span>
          <span className="wallet__sub">{describe.subtitle}</span>
          <span className="wallet__meta">
            {order.id} · {formatPrice(order.total)} · {dateFormat.format(order.createdAt)}
          </span>
        </span>
        <Chevron />
      </button>
    </li>
  )
}

/**
 * "Meus ingressos": todos os ingressos comprados (guardados no navegador).
 * A lista leva ao ingresso completo, e dele dá para ver o jogo do lugar.
 */
export function WalletPanel() {
  const open = useExperience((s) => s.walletOpen)
  const orders = useExperience((s) => s.orders)
  const walletOrder = useExperience((s) => s.walletOrder)
  const closeWallet = useExperience((s) => s.closeWallet)
  const showWalletOrder = useExperience((s) => s.showWalletOrder)
  const openOrderPov = useExperience((s) => s.openOrderPov)
  const selected = orders.find((o) => o.id === walletOrder) ?? null
  const tab = open ? 0 : -1

  return (
    <div
      className="sheet sheet--wallet"
      data-visible={open}
      aria-hidden={!open}
      onClick={(e) => {
        // clique fora do cartão fecha a carteira
        if (e.target === e.currentTarget) closeWallet()
      }}
    >
      <section className="sheet__card wallet glass" aria-label="Meus ingressos">
        <header className="sheet__head">
          {selected && (
            <button className="browse__btn" type="button" onClick={() => showWalletOrder(null)} tabIndex={tab} aria-label="Todos os ingressos">
              <Chevron left />
            </button>
          )}
          <h2 className="sheet__title">{selected ? 'Seu ingresso' : 'Meus ingressos'}</h2>
          <button className="browse__btn wallet__close" type="button" onClick={closeWallet} tabIndex={tab} aria-label="Fechar">
            <CloseIcon />
          </button>
        </header>

        {selected ? (
          <>
            <TicketCard order={selected} />
            <div className="actions">
              <button className="btn btn--primary" type="button" onClick={() => openOrderPov(selected.id)} tabIndex={tab}>
                <EyeIcon />
                {selected.kind === 'seat' ? 'Ver o jogo do meu lugar' : 'Ver o jogo do camarote'}
              </button>
            </div>
          </>
        ) : orders.length ? (
          <>
            <p className="wallet__intro">
              {orders.length === 1 ? '1 ingresso' : `${orders.length} ingressos`} para a final, guardados neste navegador.
            </p>
            <ul className="wallet__list">
              {orders.map((order) => (
                <WalletItem key={order.id} order={order} onOpen={() => showWalletOrder(order.id)} tab={tab} />
              ))}
            </ul>
          </>
        ) : (
          <p className="wallet__empty">Você ainda não comprou ingressos. Escolha um setor para começar.</p>
        )}
      </section>
    </div>
  )
}
