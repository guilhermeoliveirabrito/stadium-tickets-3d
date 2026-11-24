import { create } from 'zustand'
import { getBlockInfo } from '../lib/blocks'
import { getLayout } from '../lib/layout'
import { getSkyboxes } from '../lib/skyboxes'

/**
 * loading → intro → aerial (visão geral) → sector (câmera desce até o setor)
 * → block (de frente para o bloco, escolhendo a cadeira) → seat (zoom na
 * cadeira) ⇄ pov (a vista de quem senta nela) → checkout (pagamento) → done
 * (ingresso). Os camarotes têm uma etapa própria, box, aberta da visão geral,
 * do setor ou da cadeira, e também seguem para o pagamento. Os ingressos
 * comprados ficam em "Meus ingressos" (a carteira), aberta por cima de
 * qualquer etapa.
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
  /** quando foi comprado (ms) */
  createdAt: number
  /** foto da vista do lugar, guardada junto com o ingresso */
  shot?: string
}

/** taxa de serviço sobre o valor do ingresso */
export const SERVICE_FEE = 0.1

/**
 * Ingressos guardados no navegador. Todos ficam guardados (até um limite que
 * não se alcança usando o site), mas só os mais recentes levam a foto da
 * vista, que é o que ocupa espaço.
 */
const MAX_SAVED = 100
const MAX_SHOTS = 12
const STORAGE_KEY = 'tribuna.ingressos.v1'
const PAYMENT_METHODS: PaymentMethod[] = ['pix', 'card', 'wallet']

/** Volta da vista do lugar aberta pela carteira: a etapa e a escolha de antes (inclusive outra vista do lugar). */
interface PovReturn {
  phase: Phase
  selectedBlock: number
  selectedSeat: number
  selectedBox: number
  povKind: 'seat' | 'box'
  povFrom: Phase
  orderId: string
}

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
  /** vista do lugar aberta pela carteira: para onde voltar */
  povReturn: PovReturn | null
  /** item em pagamento e a etapa para onde o "voltar" do pagamento leva */
  checkoutItem: OrderItem | null
  checkoutFrom: Phase
  /** compra que acabou de ser concluída (o ingresso mostrado na confirmação) */
  order: Order | null
  /** todos os ingressos comprados, do mais novo ao mais antigo (guardados no navegador) */
  orders: Order[]
  /** carteira aberta e o ingresso aberto nela (null = a lista) */
  walletOpen: boolean
  walletOrder: string | null
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
  /** abre a carteira (na lista, ou já num ingresso) */
  openWallet: (orderId?: string | null) => void
  closeWallet: () => void
  /** abre um ingresso da carteira (null = volta para a lista) */
  showWalletOrder: (orderId: string | null) => void
  /** da carteira para a vista do lugar de um ingresso; "voltar" retorna à carteira */
  openOrderPov: (orderId: string) => void
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

const isCount = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0

/**
 * Confere um ingresso lido do navegador. O que vem de lá pode estar
 * incompleto ou alterado (de outra versão do site, ou mexido à mão), e um
 * ingresso inválido derrubaria a tela: só passa o que faz sentido neste
 * estádio, e o bloco é recalculado a partir da cadeira.
 */
function readOrder(value: unknown): Order | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  const { seats } = getLayout()
  const boxes = getSkyboxes()
  const isIndex = (n: unknown, count: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < count
  if (typeof o.id !== 'string' || o.id.length > 24) return null
  if (!isCount(o.price) || !isCount(o.fee) || !isCount(o.total)) return null
  // data dentro do que o Date aceita (senão a data no ingresso quebra a tela)
  if (!isCount(o.createdAt) || (o.createdAt as number) > 8.64e15) return null
  if (!PAYMENT_METHODS.includes(o.method as PaymentMethod)) return null
  const base = {
    id: o.id,
    price: o.price as number,
    fee: o.fee as number,
    total: o.total as number,
    name: typeof o.name === 'string' ? o.name.slice(0, 40) : '',
    method: o.method as PaymentMethod,
    createdAt: o.createdAt as number,
    shot: typeof o.shot === 'string' && o.shot.startsWith('data:image/') ? o.shot : undefined,
  }
  if (o.kind === 'seat' && isIndex(o.seat, seats.count)) return { ...base, kind: 'seat', seat: o.seat, block: seats.block[o.seat], box: -1 }
  if (o.kind === 'box' && isIndex(o.box, boxes.length)) return { ...base, kind: 'box', seat: -1, block: -1, box: o.box }
  return null
}

/** Ingressos guardados no navegador (some sem erro se o armazenamento não estiver disponível). */
function loadOrders(): Order[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const orders: Order[] = []
    for (const value of parsed) {
      const order = readOrder(value)
      // um ingresso por lugar
      if (order && !orders.some((o) => o.id === order.id || ownedOrder([o], order.kind, orderPlace(order)))) orders.push(order)
    }
    return orders.slice(0, MAX_SAVED)
  } catch {
    return []
  }
}

function saveOrders(orders: Order[]) {
  // só os mais recentes levam a foto
  const light = (keep: number) => orders.map((o, i) => (i < keep || !o.shot ? o : { ...o, shot: undefined }))
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(light(MAX_SHOTS)))
  } catch {
    // sem espaço: guarda sem as fotos
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(light(0)))
    } catch {
      // armazenamento indisponível (aba anônima, por exemplo): fica só nesta visita
    }
  }
}

/** A pessoa já tem ingresso para esta cadeira (ou camarote)? */
export function ownedOrder(orders: Order[], kind: 'seat' | 'box', index: number) {
  return orders.find((o) => o.kind === kind && (kind === 'seat' ? o.seat === index : o.box === index)) ?? null
}

/** Chave da foto da vista de um lugar ("seat:123" ou "box:6"). */
export const povKey = (kind: 'seat' | 'box', index: number) => `${kind}:${index}`

export const orderPlace = (order: Order) => (order.kind === 'seat' ? order.seat : order.box)

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
  povReturn: null,
  checkoutItem: null,
  checkoutFrom: 'seat',
  order: null,
  orders: loadOrders(),
  walletOpen: false,
  walletOrder: null,
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
    set({ phase: 'pov', povFrom: phase, povKind: kind, povReturn: null, hoverSeat: -1 })
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
    const { phase, selectedSeat, selectedBlock, selectedBox, orders } = get()
    const fromPov = phase === 'pov' && get().povKind === kind
    if (kind === 'seat') {
      if ((phase !== 'seat' && !fromPov) || selectedSeat < 0) return
      // o mesmo lugar não é vendido duas vezes
      if (ownedOrder(orders, 'seat', selectedSeat)) return
      const item: OrderItem = { kind, seat: selectedSeat, block: selectedBlock, box: -1, price: getBlockInfo(selectedBlock).price }
      set({ checkoutItem: item, checkoutFrom: phase, phase: 'checkout' })
    } else {
      if ((phase !== 'box' && !fromPov) || selectedBox < 0 || getSkyboxes()[selectedBox].sold) return
      if (ownedOrder(orders, 'box', selectedBox)) return
      const item: OrderItem = { kind, seat: -1, block: -1, box: selectedBox, price: getSkyboxes()[selectedBox].price }
      set({ checkoutItem: item, checkoutFrom: phase, phase: 'checkout' })
    }
  },
  confirmPurchase: (name, method) => {
    const { phase, checkoutItem, orders, povShots } = get()
    if (phase !== 'checkout' || !checkoutItem) return
    const fee = Math.round(checkoutItem.price * SERVICE_FEE)
    const place = checkoutItem.kind === 'seat' ? checkoutItem.seat : checkoutItem.box
    const order: Order = {
      ...checkoutItem,
      id: orderId(),
      fee,
      total: checkoutItem.price + fee,
      name: name.trim(),
      method,
      createdAt: Date.now(),
      shot: povShots[povKey(checkoutItem.kind, place)],
    }
    const next = [order, ...orders].slice(0, MAX_SAVED)
    saveOrders(next)
    set({ phase: 'done', order, orders: next })
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
      povReturn: null,
      walletOpen: false,
    }),
  setPovShot: (key, url) => {
    const { povShots, orders } = get()
    // ingresso guardado sem foto (comprado antes de ela existir): ganha a foto agora
    const missing = orders.some((o) => !o.shot && povKey(o.kind, orderPlace(o)) === key)
    const nextOrders = missing ? orders.map((o) => (!o.shot && povKey(o.kind, orderPlace(o)) === key ? { ...o, shot: url } : o)) : orders
    if (missing) saveOrders(nextOrders)
    set({ povShots: { ...povShots, [key]: url }, orders: nextOrders })
  },
  openWallet: (orderId = null) => set({ walletOpen: true, walletOrder: orderId }),
  closeWallet: () => set({ walletOpen: false, walletOrder: null }),
  showWalletOrder: (walletOrder) => set({ walletOrder }),
  openOrderPov: (orderId) => {
    const { phase, orders, selectedBlock, selectedSeat, selectedBox, povReturn } = get()
    const order = orders.find((o) => o.id === orderId)
    if (!order) return
    // guarda onde a pessoa estava (se já veio de uma vista aberta pela carteira, mantém a volta original)
    const { povKind, povFrom } = get()
    const back: PovReturn = { ...(povReturn ?? { phase, selectedBlock, selectedSeat, selectedBox, povKind, povFrom }), orderId }
    const { seats } = getLayout()
    set({
      walletOpen: false,
      phase: 'pov',
      povKind: order.kind,
      povFrom: back.phase === 'pov' ? back.povFrom : back.phase,
      povReturn: back,
      selectedSeat: order.kind === 'seat' ? order.seat : -1,
      selectedBlock: order.kind === 'seat' ? seats.block[order.seat] : -1,
      selectedBox: order.kind === 'box' ? order.box : -1,
      hoverSeat: -1,
      hoverBox: -1,
      hoverBlock: -1,
    })
  },
  back: () => {
    const { phase, boxFrom, povFrom, checkoutFrom, povReturn, walletOpen } = get()
    // com a carteira aberta, "voltar" (Esc) fecha a carteira
    if (walletOpen) {
      set({ walletOpen: false, walletOrder: null })
      return
    }
    if (phase === 'pov' && povReturn) {
      // vista aberta pela carteira: volta para onde a pessoa estava, com a carteira no ingresso
      set({
        phase: povReturn.phase,
        selectedBlock: povReturn.selectedBlock,
        selectedSeat: povReturn.selectedSeat,
        selectedBox: povReturn.selectedBox,
        povKind: povReturn.povKind,
        povFrom: povReturn.povFrom,
        povReturn: null,
        walletOpen: true,
        walletOrder: povReturn.orderId,
      })
      return
    }
    if (phase === 'block') set({ phase: 'sector', hoverSeat: -1, selectedSeat: -1 })
    else if (phase === 'sector') set({ phase: 'aerial', selectedBlock: -1, hoverBlock: -1, hoverBox: -1 })
    else if (phase === 'seat') set({ phase: 'block' })
    else if (phase === 'pov') set({ phase: povFrom })
    else if (phase === 'box') set({ phase: boxFrom, selectedBox: -1, hoverBox: -1 })
    else if (phase === 'checkout') set({ phase: checkoutFrom })
  },
}))

/** Lugar de uma cadeira em texto: "Bloco 232 · Fileira 7 · Cadeira 11". */
export function seatPlace(seat: number) {
  const { seats, blocks } = getLayout()
  return `Bloco ${blocks[seats.block[seat]].number} · Fileira ${seats.row[seat]} · Cadeira ${seats.number[seat]}`
}

// Ingressos comprados em outra aba aparecem nesta também (e não são vendidos de novo).
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) useExperience.setState({ orders: loadOrders() })
})

/** ?intro=0 pula a abertura (útil durante o desenvolvimento). */
export const introDisabled = new URLSearchParams(window.location.search).get('intro') === '0'
