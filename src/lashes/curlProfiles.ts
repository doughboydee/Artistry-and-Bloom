/**
 * Industry lash curl families as real 2D geometry.
 *
 * Each family is a planar curve defined by how its heading angle grows along
 * the fiber (arc length s from 0 at the base to the fiber's length at the
 * tip). Integrating the heading step by step produces a polyline whose total
 * arc length equals the fiber length EXACTLY — a "12mm D curl" is 12mm of
 * fiber, curled, not a 12mm-tall shape.
 *
 * The distinction that matters for the fit test:
 *  - B → C → CC → D: progressively more total sweep with smoothly increasing
 *    curvature from base to tip (D is close to a circular arc).
 *  - L and M: a long STRAIGHT base followed by a concentrated sharp lift,
 *    then nearly straight to the tip. That flat base is why an L curl can
 *    clear a hooded lid that a D curl of the same length collides with.
 *
 * Curve convention: base at the origin, initial heading along +X, curling
 * toward +Y ("up" in the lift plane).
 */

export type CurlFamily = 'B' | 'C' | 'CC' | 'D' | 'L' | 'M'

export const CURL_FAMILIES: CurlFamily[] = ['B', 'C', 'CC', 'D', 'L', 'M']

interface CurlSpec {
  /** Fraction of the fiber that leaves the base straight. */
  baseStraightFraction: number
  /** Total heading change over the fiber, degrees. */
  sweepDeg: number
  /** Curvature ramp: 1 = even arc, >1 = curvature concentrated at the tip. */
  rampPower: number
  /**
   * Fraction of the fiber over which the sweep happens (measured from the
   * end of the straight base). 1 = spread to the tip (B–D). L/M concentrate
   * the whole sweep in a short "lift" section and run straight after it.
   */
  sweepSpanFraction: number
}

export const CURL_SPECS: Record<CurlFamily, CurlSpec> = {
  B: { baseStraightFraction: 0.2, sweepDeg: 45, rampPower: 1.3, sweepSpanFraction: 1 },
  C: { baseStraightFraction: 0.18, sweepDeg: 60, rampPower: 1.2, sweepSpanFraction: 1 },
  CC: { baseStraightFraction: 0.15, sweepDeg: 72, rampPower: 1.1, sweepSpanFraction: 1 },
  D: { baseStraightFraction: 0.12, sweepDeg: 85, rampPower: 1.0, sweepSpanFraction: 1 },
  // L/M: the bend is sharp and localized but the total lift angle is
  // moderate, and the post-bend tail is short — the tip stays low and
  // forward, which is exactly how these curls clear a hooded lid.
  L: { baseStraightFraction: 0.5, sweepDeg: 62, rampPower: 0.9, sweepSpanFraction: 0.3 },
  M: { baseStraightFraction: 0.38, sweepDeg: 74, rampPower: 1.0, sweepSpanFraction: 0.42 },
}

/** Heading angle (radians) at normalized arc position u ∈ [0, 1]. */
export function curlHeading(family: CurlFamily, u: number): number {
  const spec = CURL_SPECS[family]
  const b = spec.baseStraightFraction
  if (u <= b) return 0
  const span = spec.sweepSpanFraction * (1 - b)
  const v = Math.min(1, (u - b) / span)
  return (spec.sweepDeg * Math.PI / 180) * v ** spec.rampPower
}

export interface CurlPoint {
  x: number
  y: number
}

/**
 * The fiber's 2D polyline: `steps + 1` points, total arc length exactly
 * `lengthMm`. Base at (0,0), initial heading +X, curl lifting toward +Y.
 */
export function curlPolyline(family: CurlFamily, lengthMm: number, steps = 16): CurlPoint[] {
  const pts: CurlPoint[] = [{ x: 0, y: 0 }]
  const ds = lengthMm / steps
  let x = 0
  let y = 0
  for (let i = 0; i < steps; i++) {
    // Midpoint heading keeps the integrated arc length faithful to θ(u).
    const uMid = (i + 0.5) / steps
    const th = curlHeading(family, uMid)
    x += ds * Math.cos(th)
    y += ds * Math.sin(th)
    pts.push({ x, y })
  }
  return pts
}

/** Vertical lift of the fiber tip — handy for tests and readouts. */
export function tipLift(family: CurlFamily, lengthMm: number): number {
  const pts = curlPolyline(family, lengthMm)
  return pts[pts.length - 1]!.y
}
