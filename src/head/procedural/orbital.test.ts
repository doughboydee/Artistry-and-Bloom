import { describe, expect, it } from 'vitest'
import { NEUTRAL_PARAMS } from '../HeadModel'
import { resolveAnatomy } from '../calibration'
import { computeEyeFrame, marginPoint } from './margins'
import { EYE_HOLE_CY, EYE_HOLE_RY, NEUTRAL_EYE_X, eyeCenterX, eyeHoleRx, shellZAt, warpX } from './shell'
import { eyeSign } from './margins'

/**
 * Regression for the fold-over bug: at maximum eye spacing + length the
 * fissure's outer corner used to land OUTSIDE the fixed rim ellipse, so the
 * lid patch folded back across the eye opening. The rim must stay a healthy
 * margin outside every fissure point for every parameter combination.
 */
describe('orbital rim always encloses the fissure', () => {
  const combos = [
    { name: 'neutral', p: { ...NEUTRAL_PARAMS } },
    { name: 'wide + long', p: { ...NEUTRAL_PARAMS, eyeSpacing: 1, eyeLength: 1 } },
    { name: 'wide + long + tilted', p: { ...NEUTRAL_PARAMS, eyeSpacing: 1, eyeLength: 1, outerCornerTilt: 1 } },
    { name: 'wide + long + tilted down', p: { ...NEUTRAL_PARAMS, eyeSpacing: 1, eyeLength: 1, outerCornerTilt: 0 } },
    { name: 'close + long', p: { ...NEUTRAL_PARAMS, eyeSpacing: 0, eyeLength: 1 } },
    { name: 'everything maxed', p: { ...NEUTRAL_PARAMS, eyeSpacing: 1, eyeLength: 1, outerCornerTilt: 1, eyeOpening: 1, browProjection: 1, lidHooding: 1, age: 1 } },
    { name: 'everything zeroed', p: { ...NEUTRAL_PARAMS, eyeSpacing: 0, eyeLength: 0, outerCornerTilt: 0, eyeOpening: 0 } },
  ]

  for (const { name, p } of combos) {
    it(`keeps every spoke pointing outward: ${name}`, () => {
      const a = resolveAnatomy(p)
      for (const eye of ['left', 'right'] as const) {
        const frame = computeEyeFrame(a, eye)
        const sign = eyeSign(eye)
        const xe = eyeCenterX(a) * sign
        const rx = eyeHoleRx(a)
        let minRun = Infinity
        for (const lid of ['upper', 'lower'] as const) {
          for (let k = 0; k <= 40; k++) {
            const M = marginPoint(frame, a, lid, k / 40)
            // Same spoke construction the orbital patch uses.
            let dx = M.x - xe
            let dy = M.y - EYE_HOLE_CY
            const dLen = Math.hypot(dx, dy)
            if (dLen < 1e-3) continue
            dx /= dLen
            dy /= dLen
            const rimR = 1 / Math.sqrt((dx / rx) ** 2 + (dy / EYE_HOLE_RY) ** 2)
            const rimXN = sign * NEUTRAL_EYE_X + dx * rimR
            const rimYN = EYE_HOLE_CY + dy * rimR
            const Wx = warpX(rimXN, rimYN, a)
            // Rim must lie beyond the margin point along the spoke (in the
            // hole's XY plane) — a negative run is the fold-over bug.
            const run = (Wx - xe) * dx + (rimYN - EYE_HOLE_CY) * dy - dLen
            minRun = Math.min(minRun, run)
            // And the rim point must be a real place on the shell.
            expect(Number.isFinite(shellZAt(Wx, rimYN, a))).toBe(true)
          }
        }
        expect(minRun).toBeGreaterThan(1.5)
      }
    })
  }
})
