import type { EffectComposer } from 'postprocessing'

/**
 * Estado da câmera que outras partes da cena precisam ler: se ela está na
 * vista do lugar (primeira pessoa), se já chegou lá e se está em movimento.
 * Também guarda o compositor de efeitos, para a foto da vista (ver PovSnapshot).
 */
export const cameraState = { pov: false, povReady: false, moving: false, composer: null as EffectComposer | null }
