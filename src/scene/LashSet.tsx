import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import type { Eye, HeadModel } from '../head/HeadModel'
import { buildAnchors, buildExtensions, buildNaturalLashes } from '../lashes/fiberGeometry'
import { useAppStore, type FaceId } from '../state/store'

/**
 * Renders the natural lashes and extensions for one eye of one face.
 * Regenerates whenever the head geometry, the design, or the natural-lash
 * settings change. The generated polylines are what phase 3's fit test will
 * consume.
 */
export function LashSet({ head, faceId, eye }: { head: HeadModel; faceId: FaceId; eye: Eye }) {
  const faceParams = useAppStore((s) => s.faces[faceId])
  const design = useAppStore((s) => s.lashDesign)
  const natural = useAppStore((s) => s.naturalLashes)
  const showNatural = useAppStore((s) => s.showNaturalLashes)
  const showExtensions = useAppStore((s) => s.showExtensions)
  const invalidate = useThree((s) => s.invalidate)

  const anchors = useMemo(() => buildAnchors(eye), [eye])

  // faceParams is in the dependency list because the head regenerates its
  // geometry (bumping version) when the store's params change — the lash
  // line must be re-read afterward.
  const sets = useMemo(() => {
    const line = head.getLashLine(eye, 80)
    return {
      naturals: buildNaturalLashes(line, anchors, natural),
      extensions: buildExtensions(line, anchors, natural, design),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, eye, anchors, natural, design, faceParams])

  useEffect(() => {
    invalidate()
    return () => {
      sets.naturals.geometry.dispose()
      sets.extensions.geometry.dispose()
    }
  }, [sets, invalidate])

  return (
    <group>
      {showNatural && (
        <mesh geometry={sets.naturals.geometry}>
          <meshStandardMaterial color="#5a4a3c" roughness={0.6} />
        </mesh>
      )}
      {showExtensions && (
        <mesh geometry={sets.extensions.geometry}>
          <meshStandardMaterial color="#14100d" roughness={0.35} />
        </mesh>
      )}
    </group>
  )
}
