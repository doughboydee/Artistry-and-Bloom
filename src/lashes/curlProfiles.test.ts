import { describe, expect, it } from 'vitest'
import { CURL_FAMILIES, curlPolyline, tipLift } from './curlProfiles'

describe('curl polylines', () => {
  it('has arc length exactly equal to the fiber length', () => {
    for (const family of CURL_FAMILIES) {
      for (const len of [8, 11, 15]) {
        const pts = curlPolyline(family, len)
        let arc = 0
        for (let i = 1; i < pts.length; i++) {
          arc += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
        }
        expect(arc).toBeCloseTo(len, 6)
      }
    }
  })

  it('lifts the tip progressively more from B to D', () => {
    const [b, c, cc, d] = (['B', 'C', 'CC', 'D'] as const).map((f) => tipLift(f, 12))
    expect(b!).toBeLessThan(c!)
    expect(c!).toBeLessThan(cc!)
    expect(cc!).toBeLessThan(d!)
  })

  it('keeps the L curl base flat where B-D are already curling', () => {
    // At 40% along the fiber, L must still be straight (heading 0) while D
    // is well into its curve.
    const l = curlPolyline('L', 12, 40)
    const d = curlPolyline('D', 12, 40)
    // L: the y at 40% of the fiber should be ~0.
    expect(Math.abs(l[16]!.y)).toBeLessThan(0.05)
    expect(d[16]!.y).toBeGreaterThan(0.3)
  })

  it('gives L a sharper localized lift than D after its base', () => {
    // Heading change between 45% and 70% of the fiber (L's lift zone).
    const lift = (pts: ReturnType<typeof curlPolyline>, i0: number, i1: number) => {
      const a0 = Math.atan2(pts[i0 + 1]!.y - pts[i0]!.y, pts[i0 + 1]!.x - pts[i0]!.x)
      const a1 = Math.atan2(pts[i1 + 1]!.y - pts[i1]!.y, pts[i1 + 1]!.x - pts[i1]!.x)
      return a1 - a0
    }
    const l = curlPolyline('L', 12, 100)
    const d = curlPolyline('D', 12, 100)
    expect(lift(l, 45, 70)).toBeGreaterThan(lift(d, 45, 70))
  })

  it('every fiber curls upward and forward, never backward past vertical', () => {
    for (const family of CURL_FAMILIES) {
      const pts = curlPolyline(family, 15)
      for (let i = 1; i < pts.length; i++) {
        expect(pts[i]!.x).toBeGreaterThan(pts[i - 1]!.x - 1e-9)
        expect(pts[i]!.y).toBeGreaterThanOrEqual(pts[i - 1]!.y - 1e-9)
      }
    }
  })
})
