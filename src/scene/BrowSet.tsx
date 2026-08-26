import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import type { Eye, HeadModel } from '../head/HeadModel'
import { buildBrowHairs } from '../brows/browFibers'
import { useAppStore, type FaceId } from '../state/store'

/** Procedural brow hair for one side of one face. */
export function BrowSet({ head, faceId, eye }: { head: HeadModel; faceId: FaceId; eye: Eye }) {
  const faceParams = useAppStore((s) => s.faces[faceId])
  const browParams = useAppStore((s) => s.browParams)
  const showBrows = useAppStore((s) => s.showBrows)
  const invalidate = useThree((s) => s.invalidate)

  const set = useMemo(() => {
    return buildBrowHairs(head.getBrowRegion(eye), eye, browParams, faceParams.age)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, eye, browParams, faceParams])

  useEffect(() => {
    invalidate()
    return () => set.geometry.dispose()
  }, [set, invalidate])

  if (!showBrows) return null
  return (
    <mesh geometry={set.geometry}>
      <meshStandardMaterial color="#3a2f26" roughness={0.7} />
    </mesh>
  )
}
