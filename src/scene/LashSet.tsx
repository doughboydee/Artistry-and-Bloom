import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import type { BufferGeometry } from 'three'
import type { Eye, HeadModel } from '../head/HeadModel'
import { SkinBVH } from '../fit/skinBvh'
import { runFitTest, type FiberVerdict, type FitSummary } from '../fit/runFitTest'
import {
  buildAnchors,
  buildExtensions,
  buildNaturalLashes,
  buildTubeGeometryFor,
  type FiberSet,
} from '../lashes/fiberGeometry'
import { agedNaturalLashes } from '../lashes/lashDesign'
import { useAppStore, type FaceId } from '../state/store'

const VERDICT_COLORS: Record<Exclude<FiberVerdict, 'ghosted'>, string> = {
  safe: '#14100d',
  near: '#d99a2b',
  colliding: '#d43333',
}

// How long a slider must rest before the fit test re-runs. Fibers and the
// head move live; the red/amber verdicts follow a beat later so dragging a
// slider stays smooth.
const FIT_SETTLE_MS = 150

type FitState = {
  builtFrom: unknown
  geometries: { verdict: FiberVerdict; geometry: BufferGeometry }[]
  summary: FitSummary
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
  // version) when params change — the lash line must be re-read after.
  const built = useMemo(() => {
    const line = head.getLashLine(eye, 80)
    // The client's lashes age with the face: thinner, shorter, straighter —
    // and extensions can only attach where a natural lash still grows.
    const aged = agedNaturalLashes(natural, faceParams.age)
    const naturals = buildNaturalLashes(line, anchors, aged)
    const extensions = buildExtensions(line, anchors, aged, design)
    return { naturals, extensions }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, eye, anchors, natural, design, faceParams])

  useEffect(() => {
    invalidate()
    return () => {
      built.naturals.geometry.dispose()
      built.extensions.geometry.dispose()
    }
  }, [built, invalidate])

  // The fit test (collision + occlusion against the skin) is the expensive
  // step, so it runs debounced: only after the fibers have stopped changing.
  const [fit, setFit] = useState<FitState | null>(null)
  useEffect(() => {
    if (!fitSettings.enabled) {
      setFit(null)
      return
    }
    const handle = setTimeout(() => {
      setFit(computeFit(built.extensions, bvh, fitSettings))
      invalidate()
    }, FIT_SETTLE_MS)
    return () => clearTimeout(handle)
  }, [
    built,
    bvh,
    fitSettings.enabled,
    fitSettings.safetyMarginMm,
    fitSettings.ghostThreshold,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    invalidate,
  ])

  useEffect(() => {
    if (fit) reportFitResult(faceId, eye, fit.summary)
    return () => {
      if (fit) for (const g of fit.geometries) g.geometry.dispose()
    }
  }, [fit, faceId, eye, reportFitResult])

  // Only trust a fit result computed from the fibers currently on screen;
  // while the verdict is catching up, show the plain extension set.
  const fitCurrent = fit && fit.builtFrom === built.extensions ? fit : null

  return (
    <group>
      {showNatural && (
        <mesh geometry={built.naturals.geometry}>
          <meshStandardMaterial color="#5a4a3c" roughness={0.6} />
        </mesh>
      )}
      {showExtensions && !fitCurrent && (
        <mesh geometry={built.extensions.geometry}>
          <meshStandardMaterial color={VERDICT_COLORS.safe} roughness={0.35} />
        </mesh>
      )}
      {showExtensions &&
        fitCurrent &&
        fitCurrent.geometries.map(({ verdict, geometry }) =>
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

function computeFit(
  extensions: FiberSet,
  bvh: SkinBVH,
  fitSettings: { safetyMarginMm: number; ghostThreshold: number },
): FitState {
  const outcome = runFitTest(
    extensions,
    bvh,
    fitSettings.safetyMarginMm,
    fitSettings.ghostThreshold,
  )
  const groups: Record<FiberVerdict, number[]> = {
    safe: [],
    near: [],
    colliding: [],
    ghosted: [],
  }
  outcome.verdicts.forEach((v, i) => groups[v].push(i))
  const geometries: FitState['geometries'] = []
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
  return { builtFrom: extensions, geometries, summary: outcome.summary }
}
