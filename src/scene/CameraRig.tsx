import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useAppStore } from '../state/store'

// Camera presets in mm (1 unit = 1 mm). The head's eye level is y = 0.
const PRESETS = {
  front: { pos: [0, 0, 260] as const, target: [0, 0, 15] as const },
  profile: { pos: [280, 5, 15] as const, target: [0, 0, 15] as const },
  free: { pos: [140, 50, 280] as const, target: [0, 0, 15] as const },
}

export function CameraRig({ viewId = 'A' }: { viewId?: string }) {
  const controlsRef = useRef<CameraControls>(null)
  const preset = useAppStore((s) => s.view.preset)
  const presetNonce = useAppStore((s) => s.view.presetNonce)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const { pos, target } = PRESETS[preset]
    void controls.setLookAt(pos[0], pos[1], pos[2], target[0], target[1], target[2], true)
  }, [preset, presetNonce])

  // Test hook: lets automated end-to-end checks position the camera exactly.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    if (viewId === 'A') w.__cameraControls = controlsRef.current
    else w.__cameraControlsB = controlsRef.current
    w.__invalidate = invalidate
  })

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={80}
      maxDistance={900}
      makeDefault
    />
  )
}
