import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry } from 'three'
import { ProceduralHead } from '../head/procedural/ProceduralHead'
import { SkinBVH } from '../fit/skinBvh'
import { useAppStore, type FaceId } from '../state/store'
import { BrowSet } from './BrowSet'
import { LashSet } from './LashSet'
import { MappingLines } from './MappingLines'

/**
 * Owns the HeadModel instance for one face and keeps it in sync with the
 * store. The rest of the scene only sees the HeadModel contract, so a
 * sculpted head can replace ProceduralHead here without touching anything
 * else.
 */
export function HeadRoot({ faceId }: { faceId: FaceId }) {
  const params = useAppStore((s) => s.faces[faceId])
  const showLashLineDebug = useAppStore((s) => s.view.showLashLineDebug)
  const invalidate = useThree((s) => s.invalidate)

  const head = useMemo(() => new ProceduralHead(params), [])
  const bvh = useMemo(() => new SkinBVH(head), [head])
  useEffect(() => () => head.dispose(), [head])

  // Apply parameters during render (before children render) so LashSet reads
  // the lash line from the already-updated head. Idempotent, so React's
  // double-render in strict mode is harmless.
  useMemo(() => {
    head.setParams(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, params])

  useEffect(() => {
    invalidate()
  }, [head, params, invalidate])

  // Debug: the lash-line samples the lash generator will attach to. Proves
  // the attachment contract tracks the lid margin under every parameter.
  const lashLineGeometry = useMemo(() => {
    if (!showLashLineDebug) return null
    const geo = new BufferGeometry()
    const pts: number[] = []
    for (const eye of ['left', 'right'] as const) {
      for (const s of head.getLashLine(eye, 40)) {
        pts.push(
          s.position.x + s.growthDir.x * 0.6,
          s.position.y + s.growthDir.y * 0.6,
          s.position.z + s.growthDir.z * 0.6,
        )
      }
    }
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3))
    return geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, params, showLashLineDebug])

  useEffect(() => () => lashLineGeometry?.dispose(), [lashLineGeometry])

  return (
    <group>
      <primitive object={head.skinMesh} />
      {head.auxMeshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
      {lashLineGeometry && (
        <points geometry={lashLineGeometry}>
          <pointsMaterial color="#ff4d6d" size={1.6} sizeAttenuation />
        </points>
      )}
      <LashSet head={head} bvh={bvh} faceId={faceId} eye="left" />
      <LashSet head={head} bvh={bvh} faceId={faceId} eye="right" />
      <BrowSet head={head} faceId={faceId} eye="left" />
      <BrowSet head={head} faceId={faceId} eye="right" />
      <MappingLines head={head} faceId={faceId} />
    </group>
  )
}
