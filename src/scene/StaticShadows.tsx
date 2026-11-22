import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'

/**
 * O cenário não se move, então o mapa de sombras é renderizado só nos
 * primeiros quadros em vez de a cada frame.
 */
export function StaticShadows({ frames = 3 }: { frames?: number }) {
  const gl = useThree((s) => s.gl)
  const remaining = useRef(frames)

  useLayoutEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])

  useFrame(() => {
    if (remaining.current <= 0) return
    remaining.current--
    gl.shadowMap.needsUpdate = true
  })

  return null
}
