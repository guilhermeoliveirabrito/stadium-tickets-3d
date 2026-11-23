import { create } from 'zustand'

/**
 * loading → intro → aerial (visão geral) → sector (câmera desce até o setor)
 * → block (de frente para o bloco, escolhendo a cadeira). Os camarotes têm
 * uma etapa própria, box, aberta da visão geral ou do setor.
 */
export type Phase = 'loading' | 'intro' | 'aerial' | 'sector' | 'block' | 'box'

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
  /** camarote reservado (-1 = nenhum) */
  reservedBox: number
  /** etapa para onde volta quem sai do camarote */
  boxFrom: Phase
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
  setHoverBox: (box: number) => void
  /** abre a vista de um camarote (da visão geral, do setor ou de outro camarote) */
  selectBox: (box: number) => void
  reserveBox: (box: number) => void
  /** volta uma etapa (bloco → setor → visão geral; camarote → de onde veio) */
  back: () => void
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
  reservedBox: -1,
  boxFrom: 'aerial',
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
  setHoverBox: (hoverBox) => {
    if (get().hoverBox !== hoverBox) set({ hoverBox })
  },
  selectBox: (box) => {
    const { phase } = get()
    if (phase !== 'aerial' && phase !== 'sector' && phase !== 'box') return
    set({
      selectedBox: box,
      phase: 'box',
      boxFrom: phase === 'box' ? get().boxFrom : phase,
      hoverBlock: -1,
      hoverBox: -1,
    })
  },
  reserveBox: (reservedBox) => set({ reservedBox }),
  back: () => {
    const { phase, boxFrom } = get()
    if (phase === 'block') set({ phase: 'sector', hoverSeat: -1, selectedSeat: -1 })
    else if (phase === 'sector') set({ phase: 'aerial', selectedBlock: -1, hoverBlock: -1, hoverBox: -1 })
    else if (phase === 'box') set({ phase: boxFrom, selectedBox: -1, hoverBox: -1 })
  },
}))

/** ?intro=0 pula a abertura (útil durante o desenvolvimento). */
export const introDisabled = new URLSearchParams(window.location.search).get('intro') === '0'
