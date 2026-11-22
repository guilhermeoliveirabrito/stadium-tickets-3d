import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { HalfFloatType, WebGLRenderTarget } from 'three'

/**
 * Compila todos os shaders da cena antes do primeiro quadro, em paralelo
 * quando o navegador permite (KHR_parallel_shader_compile). Sem isso, o
 * primeiro quadro compila uns 50 programas em sequência e a página trava por
 * alguns segundos, principalmente no Windows.
 */
export function Precompile({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      onDone()
    }
    // O pós-processamento desenha a cena num render target (cor linear, sem
    // tone mapping); compilando no mesmo tipo de alvo, os programas gerados
    // são exatamente os que serão usados.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
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
        target.dispose()
        finish()
      })
    return () => window.clearTimeout(fallback)
  }, [gl, scene, camera, onDone])

  return null
}
