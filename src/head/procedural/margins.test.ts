import { describe, expect, it } from 'vitest'
import { CALIBRATION, resolveAnatomy } from '../calibration'
import { NEUTRAL_PARAMS } from '../HeadModel'
import { computeEyeFrame, marginPoint, sampleLashLine } from './margins'

const neutral = resolveAnatomy(NEUTRAL_PARAMS)

describe('eye frame', () => {
  it('places inner canthi exactly eyeSpacing apart', () => {
    const left = computeEyeFrame(neutral, 'left')
    const right = computeEyeFrame(neutral, 'right')
    expect(left.innerXY.x - right.innerXY.x).toBeCloseTo(neutral.eyeSpacingMm, 6)
    expect(left.innerXY.y).toBe(0)
  })

  it('places canthi exactly eyeLength apart', () => {
    const f = computeEyeFrame(neutral, 'left')
    const d = Math.hypot(f.outerXY.x - f.innerXY.x, f.outerXY.y - f.innerXY.y)
    expect(d).toBeCloseTo(neutral.eyeLengthMm, 6)
  })

  it('raises the outer corner by the tilt angle', () => {
    const up = resolveAnatomy({ ...NEUTRAL_PARAMS, outerCornerTilt: 1 })
    const down = resolveAnatomy({ ...NEUTRAL_PARAMS, outerCornerTilt: 0 })
    const fUp = computeEyeFrame(up, 'left')
    const fDown = computeEyeFrame(down, 'left')
    expect(fUp.outerXY.y).toBeGreaterThan(fDown.outerXY.y)
    expect(fUp.outerXY.y).toBeCloseTo(up.eyeLengthMm * Math.sin(up.outerCornerTiltRad), 6)
  })

  it('mirrors the two eyes across the midline', () => {
    const left = computeEyeFrame(neutral, 'left')
    const right = computeEyeFrame(neutral, 'right')
    expect(left.globeCenter.x).toBeCloseTo(-right.globeCenter.x, 6)
    expect(left.globeCenter.y).toBeCloseTo(right.globeCenter.y, 6)
    expect(left.globeCenter.z).toBeCloseTo(right.globeCenter.z, 6)
  })
})

describe('lid margin', () => {
  it('starts and ends exactly at the canthi (in XY)', () => {
    const f = computeEyeFrame(neutral, 'left')
    const start = marginPoint(f, neutral, 'upper', 0)
    const end = marginPoint(f, neutral, 'upper', 1)
    expect(start.x).toBeCloseTo(f.innerXY.x, 6)
    expect(start.y).toBeCloseTo(f.innerXY.y, 6)
    expect(end.x).toBeCloseTo(f.outerXY.x, 6)
    expect(end.y).toBeCloseTo(f.outerXY.y, 6)
  })

  it('upper margin arcs above and lower below the canthus chord', () => {
    const f = computeEyeFrame(neutral, 'left')
    const upperMid = marginPoint(f, neutral, 'upper', 0.4)
    const lowerMid = marginPoint(f, neutral, 'lower', 0.6)
    const chordY = (f.innerXY.y + f.outerXY.y) / 2
    expect(upperMid.y).toBeGreaterThan(chordY)
    expect(lowerMid.y).toBeLessThan(chordY)
  })

  it('never places the margin inside the globe', () => {
    for (const params of [
      NEUTRAL_PARAMS,
      { ...NEUTRAL_PARAMS, eyeOpening: 1, eyeLength: 1 },
      { ...NEUTRAL_PARAMS, eyeOpening: 0, eyeLength: 0, eyeDepth: 1 },
    ]) {
      const a = resolveAnatomy(params)
      const f = computeEyeFrame(a, 'left')
      for (let i = 0; i <= 20; i++) {
        const p = marginPoint(f, a, 'upper', i / 20)
        expect(p.distanceTo(f.globeCenter)).toBeGreaterThanOrEqual(a.globeRadiusMm - 1e-6)
      }
    }
  })
})

describe('lash line samples', () => {
  it('returns arc-length-uniform samples with unit frames', () => {
    const f = computeEyeFrame(neutral, 'left')
    const samples = sampleLashLine(f, neutral, 'left', 40)
    expect(samples).toHaveLength(40)
    expect(samples[0]!.t).toBe(0)
    expect(samples[39]!.t).toBe(1)
    // Spacing between consecutive samples should be nearly constant.
    const gaps: number[] = []
    for (let i = 1; i < samples.length; i++) {
      gaps.push(samples[i]!.position.distanceTo(samples[i - 1]!.position))
    }
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length
    for (const g of gaps) expect(Math.abs(g - mean) / mean).toBeLessThan(0.25)
    for (const s of samples) {
      expect(s.tangent.length()).toBeCloseTo(1, 3)
      expect(s.surfaceNormal.length()).toBeCloseTo(1, 3)
      expect(s.growthDir.length()).toBeCloseTo(1, 3)
      // Growth direction must point away from the globe (never into the eye).
      expect(s.growthDir.dot(s.surfaceNormal)).toBeGreaterThan(0)
    }
  })
})

describe('calibration', () => {
  it('is monotonic where the anatomy demands it', () => {
    const lo = resolveAnatomy({ ...NEUTRAL_PARAMS, browProjection: 0, eyeDepth: 0, creaseHeight: 0 })
    const hi = resolveAnatomy({ ...NEUTRAL_PARAMS, browProjection: 1, eyeDepth: 1, creaseHeight: 1 })
    expect(hi.browProjectionMm).toBeGreaterThan(lo.browProjectionMm)
    expect(hi.creaseHeightMm).toBeGreaterThan(lo.creaseHeightMm)
    // Deep-set (1) puts the globe further back than protruding (0).
    expect(hi.globeCenterZMm).toBeLessThan(lo.globeCenterZMm)
  })

  it('keeps every range in plausible adult bounds', () => {
    expect(CALIBRATION.eyeSpacingMm[0]).toBeGreaterThan(20)
    expect(CALIBRATION.eyeSpacingMm[1]).toBeLessThan(50)
    expect(CALIBRATION.eyeLengthMm[0]).toBeGreaterThan(18)
    expect(CALIBRATION.eyeLengthMm[1]).toBeLessThan(40)
    expect(CALIBRATION.globeRadiusMm).toBeCloseTo(12, 0)
  })
})
