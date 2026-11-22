import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'

/**
 * Câmera livre para depuração, ativada com ?cam=x,y,z,alvoX,alvoY,alvoZ
 * (somente em desenvolvimento).
 */
export function DevCamera() {
  const camera = useThree((s) => s.camera)
  const params = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get('cam')
    const values = raw?.split(',').map(Number)
    return values?.length === 6 && values.every(Number.isFinite) ? values : null
  }, [])

  useLayoutEffect(() => {
    if (!params) return
    camera.position.set(params[0], params[1], params[2])
    camera.lookAt(params[3], params[4], params[5])
  }, [camera, params])

  if (!params) return null
  return <OrbitControls makeDefault target={[params[3], params[4], params[5]]} />
}
