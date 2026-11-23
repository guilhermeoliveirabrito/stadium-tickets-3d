import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { HalfFloatType, type Object3D, WebGLRenderTarget } from 'three'
import { introDisabled, useExperience } from '../store/experience'
import { bootTitleRemainingMs } from '../ui/bootSequence'

/**
 * Prepara a cena antes do primeiro quadro visível:
 * 1. compila todos os shaders, em paralelo quando o navegador permite
 *    (KHR_parallel_shader_compile), sem travar a página;
 * 2. desenha a cena inteira uma vez num alvo de 1×1 pixel, com tudo visível e
 *    sem descarte, para enviar todas as geometrias e texturas à placa de vídeo
 *    de uma vez. Com um pixel só, o desenho em si não custa nada; antes isso
 *    era feito num quadro de tela cheia, o mais caro de todo o carregamento.
 *    Esse envio espera o título da abertura terminar de aparecer: no meio da
 *    animação ele podia travar o desenho da tela e fazer o texto pular.
 */
export function Precompile({ onDone, waitForTitle = true }: { onDone: () => void; waitForTitle?: boolean }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    let finished = false
    // O pós-processamento desenha a cena num alvo assim (cor linear, sem tone
    // mapping): compilando e aquecendo nele, os programas são os mesmos usados depois.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType })

    const warmUp = () => {
      const saved: { object: Object3D; culled: boolean; visible: boolean }[] = []
      scene.traverse((object) => {
        saved.push({ object, culled: object.frustumCulled, visible: object.visible })
        object.frustumCulled = false
        object.visible = true
      })
      const previous = gl.getRenderTarget()
      try {
        gl.setRenderTarget(target)
        gl.render(scene, camera)
      } catch {
        // se falhar, o envio acontece aos poucos nos primeiros quadros, como antes
      } finally {
        gl.setRenderTarget(previous)
        for (const { object, culled, visible } of saved) {
          object.frustumCulled = culled
          object.visible = visible
        }
      }
    }

    let warmTimer = 0
    let unsubscribe = () => {}
    const finish = () => {
      if (finished) return
      finished = true
      let ran = false
      const run = () => {
        if (ran) return
        ran = true
        window.clearTimeout(warmTimer)
        unsubscribe()
        warmUp()
        target.dispose()
        onDone()
      }
      const wait = introDisabled || !waitForTitle ? 0 : bootTitleRemainingMs()
      if (wait <= 0) return run()
      warmTimer = window.setTimeout(run, wait)
      // se a pessoa pular a abertura, não há animação a proteger
      unsubscribe = useExperience.subscribe((state) => state.introSkipped && run())
    }

    const previous = gl.getRenderTarget()
    let pending: Promise<unknown> = Promise.resolve()
    try {
      gl.setRenderTarget(target)
      pending = gl.compileAsync(scene, camera)
    } catch {
      // se algo falhar, a cena compila no primeiro quadro, como antes
    } finally {
      gl.setRenderTarget(previous)
    }
    const fallback = window.setTimeout(finish, 10000)
    pending
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(fallback)
        finish()
      })
    return () => {
      window.clearTimeout(fallback)
      window.clearTimeout(warmTimer)
      unsubscribe()
    }
  }, [gl, scene, camera, onDone, waitForTitle])

  return null
}
