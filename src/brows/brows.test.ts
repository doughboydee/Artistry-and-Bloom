import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { NEUTRAL_PARAMS, type AnatomyParams, type Eye } from '../head/HeadModel'
import { ProceduralHead } from '../head/procedural/ProceduralHead'
import { DEFAULT_BROW_PARAMS } from './browDesign'
import { buildBrowHairs } from './browFibers'
import { computeMappingLines } from './mappingLines'

const make = (params: AnatomyParams = NEUTRAL_PARAMS) => new ProceduralHead(params)

const mapping = (head: ProceduralHead) =>
  computeMappingLines(head.getLandmarks(), (eye: Eye) => head.getBrowRegion(eye))

describe('brow mapping lines', () => {
  it('orders the three points start < arch < tail laterally', () => {
    const m = mapping(make())
    expect(Math.abs(m.left.start.browPoint.x)).toBeLessThan(Math.abs(m.left.arch.browPoint.x))
    expect(Math.abs(m.left.arch.browPoint.x)).toBeLessThan(Math.abs(m.left.tail.browPoint.x))
    expect(m.right.start.browPoint.x).toBeCloseTo(-m.left.start.browPoint.x, 0)
  })

  it('moves all three points when the nose widens (inward — the string pivots at the eye landmark)', () => {
    const narrow = mapping(make({ ...NEUTRAL_PARAMS, noseBaseWidth: 0 }))
    const wide = mapping(make({ ...NEUTRAL_PARAMS, noseBaseWidth: 1 }))
    for (const key of ['start', 'arch', 'tail'] as const) {
      const shift = Math.abs(narrow.left[key].browPoint.x) - Math.abs(wide.left[key].browPoint.x)
      // Moving the nostril anchor outward rotates the extension beyond the
      // fixed landmark toward the midline; the move must be visible (>1mm).
      expect(shift).toBeGreaterThan(1)
    }
  })

  it('moves the arch point outward when the eyes are wider set', () => {
    const close = mapping(make({ ...NEUTRAL_PARAMS, eyeSpacing: 0 }))
    const wide = mapping(make({ ...NEUTRAL_PARAMS, eyeSpacing: 1 }))
    expect(Math.abs(wide.left.arch.browPoint.x)).toBeGreaterThan(
      Math.abs(close.left.arch.browPoint.x),
    )
  })

  it('lands the points at brow height, above the eye', () => {
    const head = make()
    const m = mapping(head)
    const pupilY = head.getLandmarks().pupil.left.y
    for (const key of ['start', 'arch', 'tail'] as const) {
      expect(m.left[key].browPoint.y).toBeGreaterThan(pupilY + 12)
      expect(m.left[key].browPoint.y).toBeLessThan(pupilY + 40)
    }
  })
})

describe('brow hairs', () => {
  it('hair count scales with density', () => {
    const head = make()
    const region = head.getBrowRegion('left')
    const sparse = buildBrowHairs(region, 'left', { ...DEFAULT_BROW_PARAMS, density: 0 })
    const dense = buildBrowHairs(region, 'left', { ...DEFAULT_BROW_PARAMS, density: 1 })
    expect(dense.fiberCount).toBeGreaterThan(sparse.fiberCount * 2)
  })

  it('anchors every hair base close to the brow surface band', () => {
    const head = make()
    const region = head.getBrowRegion('left')
    const set = buildBrowHairs(region, 'left', DEFAULT_BROW_PARAMS)
    const rings = 17
    for (let f = 0; f < set.fiberCount; f += 7) {
      const bx = set.polylines[f * rings * 3]!
      const by = set.polylines[f * rings * 3 + 1]!
      const bz = set.polylines[f * rings * 3 + 2]!
      // Nearest point on a dense sampling of the band.
      let best = Infinity
      for (let ui = 0; ui <= 20; ui++) {
        for (let vi = 0; vi <= 8; vi++) {
          const s = region(ui / 20, vi / 8)
          const d = s.position.distanceTo(new Vector3(bx, by, bz))
          if (d < best) best = d
        }
      }
      expect(best).toBeLessThan(2.5)
    }
  })

  it('head-of-brow hairs point more upward than tail hairs', () => {
    const head = make()
    const region = head.getBrowRegion('left')
    const set = buildBrowHairs(region, 'left', DEFAULT_BROW_PARAMS)
    const rings = 17
    const upwardness = (f: number) => {
      const y0 = set.polylines[f * rings * 3 + 1]!
      const y1 = set.polylines[(f * rings + rings - 1) * 3 + 1]!
      return y1 - y0
    }
    let headSum = 0
    let headN = 0
    let tailSum = 0
    let tailN = 0
    for (let f = 0; f < set.fiberCount; f++) {
      const u = set.anchorT[f]!
      if (u < 0.25) {
        headSum += upwardness(f)
        headN++
      } else if (u > 0.75) {
        tailSum += upwardness(f)
        tailN++
      }
    }
    expect(headN).toBeGreaterThan(0)
    expect(tailN).toBeGreaterThan(0)
    expect(headSum / headN).toBeGreaterThan(tailSum / tailN)
  })
})
