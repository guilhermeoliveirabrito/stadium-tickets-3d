import { create } from 'zustand'

export type Phase = 'loading' | 'intro' | 'aerial'

interface ExperienceState {
  phase: Phase
  introSkipped: boolean
  setPhase: (phase: Phase) => void
  skipIntro: () => void
}

export const useExperience = create<ExperienceState>((set) => ({
  phase: 'loading',
  introSkipped: false,
  setPhase: (phase) => set({ phase }),
  skipIntro: () => set({ introSkipped: true }),
}))

/** ?intro=0 pula a abertura (útil durante o desenvolvimento). */
export const introDisabled = new URLSearchParams(window.location.search).get('intro') === '0'
