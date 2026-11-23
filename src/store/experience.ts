import { create } from 'zustand'

export type Phase = 'loading' | 'intro' | 'aerial'

interface ExperienceState {
  phase: Phase
  /** cena compilada e enviada à placa de vídeo; a abertura de texto pode seguir */
  sceneReady: boolean
  introSkipped: boolean
  setPhase: (phase: Phase) => void
  setSceneReady: () => void
  skipIntro: () => void
}

export const useExperience = create<ExperienceState>((set) => ({
  phase: 'loading',
  sceneReady: false,
  introSkipped: false,
  setPhase: (phase) => set({ phase }),
  setSceneReady: () => set({ sceneReady: true }),
  skipIntro: () => set({ introSkipped: true }),
}))

/** ?intro=0 pula a abertura (útil durante o desenvolvimento). */
export const introDisabled = new URLSearchParams(window.location.search).get('intro') === '0'
