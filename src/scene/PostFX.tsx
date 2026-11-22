import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export function PostFX() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO halfRes aoRadius={3.2} distanceFalloff={0.8} intensity={2.6} aoSamples={16} denoiseSamples={4} />
      <Bloom mipmapBlur luminanceThreshold={0.82} luminanceSmoothing={0.3} intensity={1.15} radius={0.78} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.06} />
      <BrightnessContrast brightness={0.01} contrast={0.08} />
      <Vignette offset={0.3} darkness={0.58} />
    </EffectComposer>
  )
}
