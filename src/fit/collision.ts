import { Vector3 } from 'three'
import { FIBER_STEPS } from '../lashes/fiberGeometry'
import type { SkinBVH } from './skinBvh'

/**
 * Collision: does an extension fiber enter the eyelid, or come dangerously
 * close? This is the too-strong-a-curl-on-the-wrong-anatomy failure — in
 * real life it pokes the client and damages her natural lash.
 *
 * The fiber's base is excluded: the first couple of millimeters legitimately
 * lie along the natural lash at the lid margin.
 */

export type CollisionStatus = 'safe' | 'near' | 'colliding'

export interface FiberCollision {
  status: CollisionStatus
  /** Worst (smallest, negative = penetration depth) signed distance, mm. */
  worstDistanceMm: number
}

const BASE_SKIP_MM = 2

export function testCollision(
  polylines: Float32Array,
  fiberCount: number,
  bvh: SkinBVH,
  safetyMarginMm: number,
): FiberCollision[] {
  const rings = FIBER_STEPS + 1
  const results: FiberCollision[] = []
  const p = new Vector3()
  const toP = new Vector3()

  for (let f = 0; f < fiberCount; f++) {
    const base = f * rings * 3
    // Fiber arc length is uniform per segment; work out how many base
    // samples fall inside the skip distance.
    const segLen =
      Math.hypot(
        polylines[base + 3]! - polylines[base]!,
        polylines[base + 4]! - polylines[base + 1]!,
        polylines[base + 5]! - polylines[base + 2]!,
      ) || 1
    const skipSamples = Math.min(rings - 2, Math.max(2, Math.ceil(BASE_SKIP_MM / segLen)))

    let worst = Infinity
    for (let i = skipSamples; i < rings; i++) {
      p.set(polylines[base + i * 3]!, polylines[base + i * 3 + 1]!, polylines[base + i * 3 + 2]!)
      const hit = bvh.closestPoint(p)
      toP.copy(p).sub(hit.point)
      const signed = hit.faceNormal.dot(toP) < 0 ? -hit.distance : hit.distance
      if (signed < worst) worst = signed
    }

    const status: CollisionStatus =
      worst < 0 ? 'colliding' : worst < safetyMarginMm ? 'near' : 'safe'
    results.push({ status, worstDistanceMm: worst })
  }
  return results
}
