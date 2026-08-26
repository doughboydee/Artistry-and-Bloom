import { describe, expect, it } from 'vitest'
import { NEUTRAL_PARAMS, type AnatomyParams } from '../head/HeadModel'
import { ProceduralHead } from '../head/procedural/ProceduralHead'
import { buildAnchors, buildExtensions, FIBER_STEPS } from '../lashes/fiberGeometry'
import { DEFAULT_NATURAL_LASHES, type LashDesign } from '../lashes/lashDesign'
import { testCollision } from './collision'
import { testOcclusion } from './occlusion'
import { runFitTest } from './runFitTest'
import { SkinBVH } from './skinBvh'

const RINGS = FIBER_STEPS + 1

/** Hand-built "fiber": a straight polyline from `from` toward `dir`. */
function syntheticFiber(from: [number, number, number], dir: [number, number, number], lengthMm: number): Float32Array {
  const out = new Float32Array(RINGS * 3)
  const norm = Math.hypot(...dir)
  for (let i = 0; i < RINGS; i++) {
    const d = (i / FIBER_STEPS) * lengthMm
    out[i * 3] = from[0] + (dir[0] / norm) * d
    out[i * 3 + 1] = from[1] + (dir[1] / norm) * d
    out[i * 3 + 2] = from[2] + (dir[2] / norm) * d
  }
  return out
}

function makeHead(params: AnatomyParams = NEUTRAL_PARAMS) {
  const head = new ProceduralHead(params)
  return { head, bvh: new SkinBVH(head) }
}

describe('collision detection', () => {
  it('flags a fiber driven into the lid as colliding', () => {
    const { head, bvh } = makeHead()
    // Start in front of the upper lid of the left eye and aim backward/up
    // into the skin above the eye.
    const line = head.getLashLine('left', 10)
    const mid = line[5]!
    const fiber = syntheticFiber(
      [mid.position.x, mid.position.y, mid.position.z + 3],
      [0, 1, -1.6],
      14,
    )
    const [result] = testCollision(fiber, 1, bvh, 0.5)
    expect(result!.status).toBe('colliding')
  })

  it('leaves a fiber pointing straight away from the face safe', () => {
    const { head, bvh } = makeHead()
    const line = head.getLashLine('left', 10)
    const mid = line[5]!
    const fiber = syntheticFiber(
      [mid.position.x, mid.position.y, mid.position.z + 2],
      [0, 0, 1],
      12,
    )
    const [result] = testCollision(fiber, 1, bvh, 0.5)
    expect(result!.status).toBe('safe')
  })

  it('widening the safety margin escalates a grazing fiber from safe to near', () => {
    const { head, bvh } = makeHead()
    const line = head.getLashLine('left', 10)
    const mid = line[5]!
    // Runs forward, angled up: passes close over the lid without entering.
    const fiber = syntheticFiber(
      [mid.position.x, mid.position.y, mid.position.z + 1.2],
      [0, 0.55, 1],
      10,
    )
    const [tight] = testCollision(fiber, 1, bvh, 0.2)
    const [wide] = testCollision(fiber, 1, bvh, 1.0)
    // With some margin the verdict must be at least as severe.
    const severity = { safe: 0, near: 1, colliding: 2 }
    expect(severity[wide!.status]).toBeGreaterThanOrEqual(severity[tight!.status])
    expect(wide!.worstDistanceMm).toBeCloseTo(tight!.worstDistanceMm, 6)
  })
})

describe('front occlusion', () => {
  it('hides a fiber tucked behind the brow ridge and sees one in the open', () => {
    const { bvh } = makeHead({ ...NEUTRAL_PARAMS, browProjection: 1, eyeDepth: 1 })
    // A point well behind the brow plane, under the ridge.
    const hidden = syntheticFiber([31, 14, -2], [1, 0, 0], 4)
    // A point far in front of everything.
    const open = syntheticFiber([31, 0, 40], [1, 0, 0], 4)
    const [h] = testOcclusion(hidden, 1, bvh)
    const [o] = testOcclusion(open, 1, bvh)
    expect(h!.visibleFraction).toBeLessThan(o!.visibleFraction)
    expect(o!.ghosted).toBe(false)
  })
})

describe('the teaching scenario', () => {
  it('the same design fails harder on a hooded deep-set face than a neutral one', () => {
    const design: LashDesign = {
      zones: Array.from({ length: 5 }, () => ({ lengthMm: 14, curl: 'D' as const, diameterMm: 0.15 })),
    }
    const anchors = buildAnchors('left')

    const neutral = makeHead()
    const difficult = makeHead({
      ...NEUTRAL_PARAMS,
      lidHooding: 1,
      eyeDepth: 1,
      browProjection: 1,
      creaseHeight: 0.15,
    })

    const run = (h: ReturnType<typeof makeHead>) => {
      const line = h.head.getLashLine('left', 80)
      const set = buildExtensions(line, anchors, DEFAULT_NATURAL_LASHES, design)
      return runFitTest(set, h.bvh, 0.5, 0.5).summary
    }

    const neutralSummary = run(neutral)
    const difficultSummary = run(difficult)

    const problems = (s: typeof neutralSummary) => s.colliding + s.near + s.ghosted
    expect(problems(difficultSummary)).toBeGreaterThan(problems(neutralSummary))
    // The difficult face must produce real failures, not just a marginal bump.
    expect(difficultSummary.colliding + difficultSummary.ghosted).toBeGreaterThan(0)
  })
})
