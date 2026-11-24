import { getBlockInfo, seatLabel } from '../lib/blocks'
import { getSkyboxes } from '../lib/skyboxes'
import type { OrderItem } from '../store/experience'

const STAND_SHORT: Record<string, string> = { N: 'N', NE: 'NE', E: 'L', SE: 'SE', S: 'S', SW: 'SO', W: 'O', NW: 'NO' }

/** Descrição do item para o ingresso e o pagamento. */
export function describeItem(item: OrderItem) {
  if (item.kind === 'seat') {
    const info = getBlockInfo(item.block)
    const seat = seatLabel(item.seat)
    return {
      title: `Fileira ${seat.row} · Cadeira ${seat.number}`,
      subtitle: `${info.standName} · ${info.tierName}`,
      label: 'Ingresso',
      details: [
        ['Bloco', String(info.block.number)],
        ['Fileira', String(seat.row)],
        ['Cadeira', String(seat.number)],
        ['Portão', `${STAND_SHORT[info.block.stand]}${info.block.level}`],
      ] as [string, string][],
    }
  }
  const box = getSkyboxes()[item.box]
  return {
    title: `Camarote ${box.number}`,
    subtitle: `${box.standName} · Camarotes VIP`,
    label: 'Camarote inteiro',
    details: [
      ['Camarote', box.number],
      ['Lugares', String(box.capacity)],
      ['Vista', box.view.replace('Vista ', '')],
      ['Portão', `VIP ${box.position[2] < 0 ? 'N' : 'S'}`],
    ] as [string, string][],
  }
}

export const METHOD_LABELS = { pix: 'Pix', card: 'Cartão de crédito', wallet: 'Carteira digital' } as const
