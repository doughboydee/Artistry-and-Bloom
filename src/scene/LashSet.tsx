import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import type { BufferGeometry } from 'three'
import type { Eye, HeadModel } from '../head/HeadModel'
import { SkinBVH } from '../fit/skinBvh'
import { runFitTest, type FiberVerdict } from '../fit/runFitTest'
import {
  buildAnchors,
  buildExtensions,
  buildNaturalLashes,
  buildTubeGeometryFor,
} from '../lashes/fiberGeometry'
import { agedNaturalLashes } from '../lashes/lashDesign'
import { useAppStore, type FaceId } from '../state/store'

const VERDICT_COLORS: Record<Exclude<FiberVerdict, 'ghosted'>, string> = {
  safe: '#14100d',
  near: '#d99a2b',
  colliding: '#d43333',
}

/**
 * Natural lashes + extensions for one eye, with the fit test applied:
 * colliding extensions render red, ones inside the safety margin amber,
 * ones hidden from the straight-ahead view ghosted. The same polylines
 * drive the rendering and the geometric tests.
 */
export function LashSet({
  head,
  bvh,
  faceId,
  eye,
}: {
  head: HeadModel
  bvh: SkinBVH
  faceId: FaceId
  eye: Eye
}) {
  const faceParams = useAppStore((s) => s.faces[faceId])
  const design = useAppStore((s) => s.lashDesign)
  const natural = useAppStore((s) => s.naturalLashes)
  const showNatural = useAppStore((s) => s.showNaturalLashes)
  const showExtensions = useAppStore((s) => s.showExtensions)
  const fitSettings = useAppStore((s) => s.fitSettings)
  const reportFitResult = useAppStore((s) => s.reportFitResult)
  const invalidate = useThree((s) => s.invalidate)

  const anchors = useMemo(() => buildAnchors(eye), [eye])

  // faceParams is a dependency because the head regenerates (bumping its
  // version) when params change — lash line and BVH must be re-read after.
  const built = useMemo(() => {
    const line = head.getLashLine(eye, 80)
    // The client's lashes age with the face: thinner, shorter, straighter —
    // and extensions can only attach where a natural lash still grows.
    const aged = agedNaturalLashes(natural, faceParams.age)
    const naturals = buildNaturalLashes(line, anchors, aged)
    const extensions = buildExtensions(line, anchors, aged, design)

    const geometries: { verdict: FiberVerdict; geometry: BufferGeometry }[] = []
    let summary = null
    if (fitSettings.enabled) {
      const outcome = runFitTest(
        extensions,
        bvh,
        fitSettings.safetyMarginMm,
        fitSettings.ghostThreshold,
      )
      summary = outcome.summary
      const groups: Record<FiberVerdict, number[]> = {
        safe: [],
        near: [],
        colliding: [],
        ghosted: [],
      }
      outcome.verdicts.forEach((v, i) => groups[v].push(i))
      for (const verdict of ['safe', 'near', 'colliding', 'ghosted'] as FiberVerdict[]) {
        if (groups[verdict].length === 0) continue
        geometries.push({
          verdict,
          geometry: buildTubeGeometryFor(
            extensions.polylines,
            groups[verdict],
            extensions.baseDiameters,
          ),
        })
      }
    } else {
      geometries.push({ verdict: 'safe', geometry: extensions.geometry })
    }

    return { naturals, extensions, geometries, summary }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, bvh, eye, anchors, natural, design, faceParams, fitSettings])

  useEffect(() => {
    if (built.summary) reportFitResult(faceId, eye, built.summary)
    invalidate()
    return () => {
      built.naturals.geometry.dispose()
      built.extensions.geometry.dispose()
      for (const g of built.geometries) {
        if (g.geometry !== built.extensions.geometry) g.geometry.dispose()
      }
    }
  }, [built, faceId, eye, reportFitResult, invalidate])

  return (
    <group>
      {showNatural && (
        <mesh geometry={built.naturals.geometry}>
          <meshStandardMaterial color="#5a4a3c" roughness={0.6} />
        </mesh>
      )}
      {showExtensions &&
        built.geometries.map(({ verdict, geometry }) =>
          verdict === 'ghosted' ? (
            fitSettings.showGhosts && (
              <mesh key={verdict} geometry={geometry}>
                <meshStandardMaterial
                  color="#8a8f98"
                  transparent
                  opacity={0.18}
                  depthWrite={false}
                  roughness={0.5}
                />
              </mesh>
            )
          ) : (
            <mesh key={verdict} geometry={geometry}>
              <meshStandardMaterial color={VERDICT_COLORS[verdict]} roughness={0.35} />
            </mesh>
          ),
        )}
    </group>
  )
}
