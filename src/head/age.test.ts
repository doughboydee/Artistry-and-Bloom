import { describe, expect, it } from 'vitest'
import { NEUTRAL_PARAMS } from './HeadModel'
import { ProceduralHead } from './procedural/ProceduralHead'
import { SkinBVH } from '../fit/skinBvh'
import { runFitTest } from '../fit/runFitTest'
import { buildAnchors, buildExtensions, buildNaturalLashes } from '../lashes/fiberGeometry'
import { DEFAULT_NATURAL_LASHES, agedNaturalLashes, type LashDesign } from '../lashes/lashDesign'

const young = () => new ProceduralHead({ ...NEUTRAL_PARAMS, age: 0 })
const old = () => new ProceduralHead({ ...NEUTRAL_PARAMS, age: 1 })

describe('the age control', () => {
  it('drops the brow as the fat pad shrinks', () => {
    const yArch = young().getBrowRegion('left')(0.5, 0.5).position.y
    const oArch = old().getBrowRegion('left')(0.5, 0.5).position.y
    expect(yArch - oArch).toBeGreaterThan(3)
  })

  it('thins and shortens the natural lashes', () => {
    const anchors = buildAnchors('left')
    const line = young().getLashLine('left', 80)
    const naturalsYoung = buildNaturalLashes(line, anchors, DEFAULT_NATURAL_LASHES)
    const naturalsOld = buildNaturalLashes(
      line,
      anchors,
      agedNaturalLashes(DEFAULT_NATURAL_LASHES, 1),
    )
    expect(naturalsOld.fiberCount).toBeLessThan(naturalsYoung.fiberCount * 0.75)
  })

  it('makes the identical realistic design fail harder on the aged face', () => {
    // A sensible map (short inner zones, like students are taught) so the
    // failures measured are the age-driven ones: the drooping hood catching
    // upward curls and the descended brow hiding fibers from the front.
    const zones = [9, 11, 13, 13, 11].map((lengthMm) => ({
      lengthMm,
      curl: 'D' as const,
      diameterMm: 0.15,
    }))
    const design: LashDesign = { zones }
    const anchors = buildAnchors('left')

    const run = (head: ProceduralHead, age: number) => {
      const bvh = new SkinBVH(head)
      const line = head.getLashLine('left', 80)
      const set = buildExtensions(line, anchors, agedNaturalLashes(DEFAULT_NATURAL_LASHES, age), design)
      return runFitTest(set, bvh, 0.5, 0.5).summary
    }

    const y = run(young(), 0)
    const o = run(old(), 1)
    const problems = (s: typeof y) => s.colliding + s.near + s.ghosted
    // Fewer total fibers on the old face, so compare failure FRACTIONS.
    expect(problems(o) / o.total).toBeGreaterThan(problems(y) / y.total)
    expect(o.colliding + o.ghosted).toBeGreaterThan(0)
  })
})
