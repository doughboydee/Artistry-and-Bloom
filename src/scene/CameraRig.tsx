import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useAppStore } from '../state/store'

// Camera presets in mm (1 unit = 1 mm). The head's eye level is y = 0.
const PRESETS = {
// Distances suit the portrait-length lens set on the Canvas (see App.tsx).
  front: { pos: [0, -8, 470] as const, target: [0, -8, 15] as const },
  profile: { pos: [490, -8, 15] as const, target: [0, -8, 15] as const },
  free: { pos: [190, 50, 370] as const, target: [0, -8, 15] as const },
}

export function CameraRig({ viewId = 'A' }: { viewId?: string }) {
  const controlsRef = useRef<CameraControls>(null)
  const preset = useAppStore((s) => s.view.preset)
  const presetNonce = useAppStore((s) => s.view.presetNonce)
  const invalidate = useThree((s) => s.invalidate)
  // In a narrow view (compare mode, phones) the head is wider than the
  // frame at the preset distance, so back the camera off in proportion.
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const backOff = Math.max(1, Math.min(2.2, 1.0 / Math.max(0.1, aspect)))

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const { pos, target } = PRESETS[preset]
    void controls.setLookAt(
      target[0] + (pos[0] - target[0]) * backOff,
      target[1] + (pos[1] - target[1]) * backOff,
      target[2] + (pos[2] - target[2]) * backOff,
      target[0],
      target[1],
      target[2],
      true,
    )
  }, [preset, presetNonce, backOff])

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
      maxDistance={1200}
      makeDefault
    />
  )
}
