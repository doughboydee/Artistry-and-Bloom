import type { FiberSet } from '../lashes/fiberGeometry'
import { testCollision, type CollisionStatus } from './collision'
import { testOcclusion } from './occlusion'
import type { SkinBVH } from './skinBvh'

/**
 * Combined fit verdict for one eye's extension set. Display priority per
 * fiber: colliding (red) > ghosted (transparent) > near (amber) > safe.
 * A fiber that both collides AND hides from the front renders red — the
 * danger signal wins.
 */
export type FiberVerdict = 'safe' | 'near' | 'colliding' | 'ghosted'

export interface FitSummary {
  total: number
  colliding: number
  near: number
  ghosted: number
}

export interface FitOutcome {
  verdicts: FiberVerdict[]
  collisionStatus: CollisionStatus[]
  visibleFraction: number[]
  summary: FitSummary
}

export function runFitTest(
  set: FiberSet,
  bvh: SkinBVH,
  safetyMarginMm: number,
  ghostThreshold: number,
): FitOutcome {
  const collisions = testCollision(set.polylines, set.fiberCount, bvh, safetyMarginMm)
  const occlusions = testOcclusion(set.polylines, set.fiberCount, bvh, ghostThreshold)

  const verdicts: FiberVerdict[] = []
  const summary: FitSummary = { total: set.fiberCount, colliding: 0, near: 0, ghosted: 0 }

  for (let f = 0; f < set.fiberCount; f++) {
    const c = collisions[f]!
    const o = occlusions[f]!
    if (c.status === 'colliding') summary.colliding++
    else if (c.status === 'near') summary.near++
    if (o.ghosted) summary.ghosted++

    let verdict: FiberVerdict
    if (c.status === 'colliding') verdict = 'colliding'
    else if (o.ghosted) verdict = 'ghosted'
    else if (c.status === 'near') verdict = 'near'
    else verdict = 'safe'
    verdicts.push(verdict)
  }

  return {
    verdicts,
    collisionStatus: collisions.map((c) => c.status),
    visibleFraction: occlusions.map((o) => o.visibleFraction),
    summary,
  }
}
