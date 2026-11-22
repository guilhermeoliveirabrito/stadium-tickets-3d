import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'

/**
 * O cenário não se move, então o mapa de sombras é renderizado só nos
 * primeiros quadros em vez de a cada frame.
 */
export function StaticShadows({ frames = 3 }: { frames?: number }) {
  const get = useThree((s) => s.get)
  const remaining = useRef(frames)

  useLayoutEffect(() => {
    const { shadowMap } = get().gl
    shadowMap.autoUpdate = false
    shadowMap.needsUpdate = true
    return () => {
      shadowMap.autoUpdate = true
    }
  }, [get])

  useFrame((state) => {
    if (remaining.current <= 0) return
    remaining.current--
    state.gl.shadowMap.needsUpdate = true
  })

  return null
}
