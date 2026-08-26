import { Vector3 } from 'three'
import { FIBER_STEPS } from '../lashes/fiberGeometry'
import type { SkinBVH } from './skinBvh'

/**
 * Front-view occlusion: which parts of an extension are hidden behind the
 * brow bone or the lid hood when the face is viewed straight-on? This is
 * the deep-set-eye failure — beautiful work that doesn't read from the
 * front.
 *
 * The canonical view is orthographic, straight down the face's forward
 * axis (+Z): deterministic, independent of how the student's on-screen
 * camera happens to be positioned, like a front-on photograph.
 */

export interface FiberOcclusion {
  /** 0 = fully hidden from the front, 1 = fully visible. */
  visibleFraction: number
  ghosted: boolean
}

const FORWARD = new Vector3(0, 0, 1)
const EPSILON_MM = 0.25
const BASE_SKIP_SAMPLES = 3

export function testOcclusion(
  polylines: Float32Array,
  fiberCount: number,
  bvh: SkinBVH,
  ghostThreshold = 0.5,
): FiberOcclusion[] {
  const rings = FIBER_STEPS + 1
  const results: FiberOcclusion[] = []
  const origin = new Vector3()

  for (let f = 0; f < fiberCount; f++) {
    const base = f * rings * 3
    let visible = 0
    let tested = 0
    for (let i = BASE_SKIP_SAMPLES; i < rings; i++) {
      origin.set(
        polylines[base + i * 3]!,
        polylines[base + i * 3 + 1]!,
        polylines[base + i * 3 + 2]! + EPSILON_MM,
      )
      tested++
      if (!bvh.raycastFirst(origin, FORWARD)) visible++
    }
    const visibleFraction = tested > 0 ? visible / tested : 1
    results.push({ visibleFraction, ghosted: visibleFraction < ghostThreshold })
  }
  return results
}
