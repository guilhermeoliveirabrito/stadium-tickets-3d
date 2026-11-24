import { create } from 'zustand'
import { getBlockInfo } from '../lib/blocks'
import { getLayout } from '../lib/layout'
import { getSkyboxes } from '../lib/skyboxes'

/**
 * loading → intro → aerial (visão geral) → sector (câmera desce até o setor)
 * → block (de frente para o bloco, escolhendo a cadeira) → seat (zoom na
 * cadeira) ⇄ pov (a vista de quem senta nela) → checkout (pagamento) → done
 * (ingresso). Os camarotes têm uma etapa própria, box, aberta da visão geral,
 * do setor ou da cadeira, e também seguem para o pagamento.
 */
export type Phase = 'loading' | 'intro' | 'aerial' | 'sector' | 'block' | 'seat' | 'pov' | 'box' | 'checkout' | 'done'

export type PaymentMethod = 'pix' | 'card' | 'wallet'

/** O que vai ser (ou foi) comprado. */
export interface OrderItem {
  kind: 'seat' | 'box'
  /** cadeira (índice global) e bloco, para ingresso de cadeira */
  seat: number
  block: number
  /** camarote, para ingresso de camarote */
  box: number
  price: number
}

export interface Order extends OrderItem {
  id: string
  fee: number
  total: number
  name: string
  method: PaymentMethod
}

/** taxa de serviço sobre o valor do ingresso */
export const SERVICE_FEE = 0.1

interface ExperienceState {
  phase: Phase
  /** cena compilada e enviada à placa de vídeo; a abertura de texto pode seguir */
  sceneReady: boolean
  introSkipped: boolean
  /** bloco sob o cursor e bloco escolhido (-1 = nenhum) */
  hoverBlock: number
  selectedBlock: number
  /** cadeira sob o cursor e cadeira escolhida (índice global, -1 = nenhuma) */
  hoverSeat: number
  selectedSeat: number
  /** camarote sob o cursor e camarote aberto (-1 = nenhum) */
  hoverBox: number
  selectedBox: number
  /** etapa para onde volta quem sai do camarote e quem sai da vista do lugar */
  boxFrom: Phase
  povFrom: Phase
  /** de onde é a vista em primeira pessoa: da cadeira escolhida ou do camarote aberto */
  povKind: 'seat' | 'box'
  /** item em pagamento e a etapa para onde o "voltar" do pagamento leva */
  checkoutItem: OrderItem | null
  checkoutFrom: Phase
  /** compra concluída (o ingresso) */
  order: Order | null
  /** fotos da vista de cada lugar (chave de povKey), para o cartão, o painel do camarote e o ingresso */
  povShots: Record<string, string>
  setPhase: (phase: Phase) => void
  setSceneReady: () => void
  skipIntro: () => void
  setHoverBlock: (block: number) => void
  /** na visão geral ou na de setor: desce até o setor do bloco */
  selectBlock: (block: number) => void
  /** do setor para a vista de frente do bloco */
  openBlock: () => void
  setHoverSeat: (seat: number) => void
  selectSeat: (seat: number) => void
  /** da vista do bloco para o zoom na cadeira escolhida */
  openSeat: () => void
  /**
   * Vista em primeira pessoa: da cadeira (na escolha da cadeira, no zoom ou
   * no ingresso) ou do camarote (no camarote ou no ingresso).
   */
  openPov: (kind: 'seat' | 'box') => void
  setHoverBox: (box: number) => void
  /** abre a vista de um camarote (da visão geral, do setor, da cadeira ou de outro camarote) */
  selectBox: (box: number) => void
  /** vai para o pagamento da cadeira escolhida ou do camarote aberto */
  openCheckout: (kind: 'seat' | 'box') => void
  /** conclui a compra (fictícia) e mostra o ingresso */
  confirmPurchase: (name: string, method: PaymentMethod) => void
  /** recomeça do zero, na visão geral */
  startOver: () => void
  setPovShot: (key: string, url: string) => void
  /** volta uma etapa (pov → cadeira → bloco → setor → visão geral; camarote e pagamento → de onde vieram) */
  back: () => void
}

/** Código do pedido, como "TRB-7K2Q9M" (sem letras que se confundem com números). */
function orderId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `TRB-${id}`
}

export const useExperience = create<ExperienceState>((set, get) => ({
  phase: 'loading',
  sceneReady: false,
  introSkipped: false,
  hoverBlock: -1,
  selectedBlock: -1,
  hoverSeat: -1,
  selectedSeat: -1,
  hoverBox: -1,
  selectedBox: -1,
  boxFrom: 'aerial',
  povFrom: 'seat',
  povKind: 'seat',
  checkoutItem: null,
  checkoutFrom: 'seat',
  order: null,
  povShots: {},
  setPhase: (phase) => set({ phase }),
  setSceneReady: () => set({ sceneReady: true }),
  skipIntro: () => set({ introSkipped: true }),
  setHoverBlock: (hoverBlock) => {
    if (get().hoverBlock !== hoverBlock) set({ hoverBlock })
  },
  selectBlock: (block) => {
    const { phase } = get()
    if (phase !== 'aerial' && phase !== 'sector') return
    set({ selectedBlock: block, phase: 'sector', hoverSeat: -1, selectedSeat: -1, hoverBox: -1 })
  },
  openBlock: () => {
    const { phase, selectedBlock } = get()
    if (phase === 'sector' && selectedBlock >= 0) set({ phase: 'block', hoverBlock: -1, hoverBox: -1 })
  },
  setHoverSeat: (hoverSeat) => {
    if (get().hoverSeat !== hoverSeat) set({ hoverSeat })
  },
  selectSeat: (selectedSeat) => set({ selectedSeat }),
  openSeat: () => {
    const { phase, selectedSeat } = get()
    if (phase === 'block' && selectedSeat >= 0) set({ phase: 'seat', hoverSeat: -1 })
  },
  openPov: (kind) => {
    const { phase, selectedSeat, selectedBox, order } = get()
    const from = kind === 'seat' ? phase === 'seat' || phase === 'block' : phase === 'box'
    const fromTicket = phase === 'done' && order?.kind === kind
    if (!from && !fromTicket) return
    if (kind === 'seat' && selectedSeat < 0) return
    if (kind === 'box' && selectedBox < 0) return
    set({ phase: 'pov', povFrom: phase, povKind: kind, hoverSeat: -1 })
  },
  setHoverBox: (hoverBox) => {
    if (get().hoverBox !== hoverBox) set({ hoverBox })
  },
  selectBox: (box) => {
    const { phase } = get()
    if (phase !== 'aerial' && phase !== 'sector' && phase !== 'box' && phase !== 'seat') return
    set({
      selectedBox: box,
      phase: 'box',
      boxFrom: phase === 'box' ? get().boxFrom : phase,
      hoverBlock: -1,
      hoverBox: -1,
    })
  },
  openCheckout: (kind) => {
    const { phase, selectedSeat, selectedBlock, selectedBox } = get()
    const fromPov = phase === 'pov' && get().povKind === kind
    if (kind === 'seat') {
      if ((phase !== 'seat' && !fromPov) || selectedSeat < 0) return
      const item: OrderItem = { kind, seat: selectedSeat, block: selectedBlock, box: -1, price: getBlockInfo(selectedBlock).price }
      set({ checkoutItem: item, checkoutFrom: phase, phase: 'checkout' })
    } else {
      if ((phase !== 'box' && !fromPov) || selectedBox < 0 || getSkyboxes()[selectedBox].sold) return
      const item: OrderItem = { kind, seat: -1, block: -1, box: selectedBox, price: getSkyboxes()[selectedBox].price }
      set({ checkoutItem: item, checkoutFrom: phase, phase: 'checkout' })
    }
  },
  confirmPurchase: (name, method) => {
    const { phase, checkoutItem } = get()
    if (phase !== 'checkout' || !checkoutItem) return
    const fee = Math.round(checkoutItem.price * SERVICE_FEE)
    set({
      phase: 'done',
      order: { ...checkoutItem, id: orderId(), fee, total: checkoutItem.price + fee, name: name.trim(), method },
    })
  },
  startOver: () =>
    set({
      phase: 'aerial',
      selectedBlock: -1,
      selectedSeat: -1,
      hoverBlock: -1,
      hoverSeat: -1,
      selectedBox: -1,
      hoverBox: -1,
      checkoutItem: null,
    }),
  setPovShot: (key, url) => set({ povShots: { ...get().povShots, [key]: url } }),
  back: () => {
    const { phase, boxFrom, povFrom, checkoutFrom } = get()
    if (phase === 'block') set({ phase: 'sector', hoverSeat: -1, selectedSeat: -1 })
    else if (phase === 'sector') set({ phase: 'aerial', selectedBlock: -1, hoverBlock: -1, hoverBox: -1 })
    else if (phase === 'seat') set({ phase: 'block' })
    else if (phase === 'pov') set({ phase: povFrom })
    else if (phase === 'box') set({ phase: boxFrom, selectedBox: -1, hoverBox: -1 })
    else if (phase === 'checkout') set({ phase: checkoutFrom })
  },
}))

/** Chave da foto da vista de um lugar ("seat:123" ou "box:6"). */
export const povKey = (kind: 'seat' | 'box', index: number) => `${kind}:${index}`

/** Lugar de uma cadeira em texto: "Bloco 232 · Fileira 7 · Cadeira 11". */
export function seatPlace(seat: number) {
  const { seats, blocks } = getLayout()
  return `Bloco ${blocks[seats.block[seat]].number} · Fileira ${seats.row[seat]} · Cadeira ${seats.number[seat]}`
}

/** ?intro=0 pula a abertura (útil durante o desenvolvimento). */
export const introDisabled = new URLSearchParams(window.location.search).get('intro') === '0'
