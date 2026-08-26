import { BufferAttribute, BufferGeometry, Vector3 } from 'three'
import type { Eye, LashLineSample } from '../head/HeadModel'
import type { CurlFamily } from './curlProfiles'
import { curlPolyline } from './curlProfiles'
import type { LashDesign, NaturalLashes } from './lashDesign'
import { zoneAt } from './lashDesign'

/**
 * Turns lash-line samples + settings into renderable fiber geometry.
 *
 * Every fiber is a 3D polyline (the curl profile mapped into the local frame
 * of its attachment point). The SAME polyline drives rendering (swept into a
 * thin tapered tube) and, in phase 3, the collision and occlusion tests —
 * so what the student sees is exactly what gets tested.
 */

export const FIBER_STEPS = 16 // polyline points per fiber = FIBER_STEPS + 1
const TUBE_SIDES = 6
const MAX_ANCHORS = 150

export interface FiberSet {
  /** One merged geometry for all fibers of this set (one draw call). */
  geometry: BufferGeometry
  /** Raw polylines: fiberCount × (FIBER_STEPS+1) × xyz — fit-test input. */
  polylines: Float32Array
  fiberCount: number
  /** Lash-line position t of each fiber (zone lookups / reporting). */
  anchorT: Float32Array
  /** Base diameter per fiber, mm (needed to rebuild subset geometries). */
  baseDiameters: Float32Array
}

/** Deterministic PRNG (mulberry32) so lashes don't reshuffle every change. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Anchor {
  t: number
  jitterFan: number // -1..1, small random fan-out
  jitterLen: number // -1..1, natural length variation
  present: number // 0..1 threshold roll against density
}

/** Lashes don't grow at the tear-duct corner or the very outer commissure:
 *  anchors cover the true lash-bearing stretch of the margin. */
const T_MIN = 0.08
const T_MAX = 0.97

/** Fixed anchor layout per eye — jitter is stable across regenerations. */
export function buildAnchors(eye: Eye, count = MAX_ANCHORS): Anchor[] {
  const rng = makeRng(eye === 'left' ? 1337 : 7331)
  const anchors: Anchor[] = []
  const span = T_MAX - T_MIN
  for (let i = 0; i < count; i++) {
    anchors.push({
      t: T_MIN + ((i + 0.5) / count) * span + (rng() - 0.5) * ((0.6 * span) / count),
      jitterFan: rng() * 2 - 1,
      jitterLen: rng() * 2 - 1,
      present: rng(),
    })
  }
  return anchors
}

/** Interpolate a lash-line frame at arbitrary t from the sampled line. */
function frameAt(line: LashLineSample[], t: number): LashLineSample {
  const ft = Math.min(Math.max(t, 0), 1) * (line.length - 1)
  const i = Math.min(line.length - 2, Math.floor(ft))
  const f = ft - i
  const a = line[i]!
  const b = line[i + 1]!
  return {
    t,
    position: a.position.clone().lerp(b.position, f),
    tangent: a.tangent.clone().lerp(b.tangent, f).normalize(),
    surfaceNormal: a.surfaceNormal.clone().lerp(b.surfaceNormal, f).normalize(),
    growthDir: a.growthDir.clone().lerp(b.growthDir, f).normalize(),
  }
}

interface FiberSpec {
  t: number
  lengthMm: number
  curl: CurlFamily
  /** Extra straight-out pitch of the launch direction, radians (natural
   *  growth direction: negative = droops down, positive = lifted). */
  launchPitchRad: number
  baseDiameterMm: number
  fanRad: number
}

/**
 * Map one fiber's 2D curl polyline into 3D at its anchor frame and write the
 * points into `out` at float offset `o`. Returns the world-space points.
 */
function writeFiberPolyline(
  out: Float32Array,
  o: number,
  frame: LashLineSample,
  spec: FiberSpec,
): void {
  // Local frame: heading H = growthDir pitched by launchPitch within the
  // (growthDir, lift) plane; lift L = direction "away from the eye" that the
  // curl bends toward.
  const lift = new Vector3().crossVectors(frame.tangent, frame.growthDir)
  if (lift.y < 0) lift.negate() // curl always lifts upward/outward, both eyes
  lift.normalize()

  const heading = frame.growthDir
    .clone()
    .multiplyScalar(Math.cos(spec.launchPitchRad))
    .addScaledVector(lift, Math.sin(spec.launchPitchRad))
    .normalize()
  // Re-orthogonalize the lift axis against the actual heading.
  const liftOrtho = lift.addScaledVector(heading, -lift.dot(heading)).normalize()

  // Small fan-out rotation about the surface normal: rotate heading/lift.
  if (spec.fanRad !== 0) {
    const n = frame.surfaceNormal
    heading.applyAxisAngle(n, spec.fanRad)
    liftOrtho.applyAxisAngle(n, spec.fanRad)
  }

  const pts2d = curlPolyline(spec.curl, spec.lengthMm, FIBER_STEPS)
  for (let i = 0; i <= FIBER_STEPS; i++) {
    const p2 = pts2d[i]!
    out[o + i * 3] = frame.position.x + heading.x * p2.x + liftOrtho.x * p2.y
    out[o + i * 3 + 1] = frame.position.y + heading.y * p2.x + liftOrtho.y * p2.y
    out[o + i * 3 + 2] = frame.position.z + heading.z * p2.x + liftOrtho.z * p2.y
  }
}

/** Sweep a subset of polylines into one merged tapered-tube geometry. */
export function buildTubeGeometryFor(
  polylines: Float32Array,
  fiberIndices: ArrayLike<number>,
  baseDiameters: Float32Array,
): BufferGeometry {
  const fiberCount = fiberIndices.length
  const ringsPerFiber = FIBER_STEPS + 1
  const vertsPerFiber = ringsPerFiber * TUBE_SIDES
  const positions = new Float32Array(fiberCount * vertsPerFiber * 3)
  const indices: number[] = []

  const p = new Vector3()
  const next = new Vector3()
  const dir = new Vector3()
  const side = new Vector3()
  const up = new Vector3()
  const UP_HINT = new Vector3(0.13, 0.35, 0.93).normalize()

  for (let n = 0; n < fiberCount; n++) {
    const f = fiberIndices[n]!
    const base = f * ringsPerFiber * 3
    const vBase = n * vertsPerFiber
    for (let i = 0; i < ringsPerFiber; i++) {
      p.set(polylines[base + i * 3]!, polylines[base + i * 3 + 1]!, polylines[base + i * 3 + 2]!)
      const j = Math.min(i + 1, ringsPerFiber - 1)
      const j0 = Math.max(j - 1, 0)
      next.set(polylines[base + j * 3]!, polylines[base + j * 3 + 1]!, polylines[base + j * 3 + 2]!)
      dir
        .set(
          next.x - polylines[base + j0 * 3]!,
          next.y - polylines[base + j0 * 3 + 1]!,
          next.z - polylines[base + j0 * 3 + 2]!,
        )
        .normalize()
      side.crossVectors(dir, UP_HINT)
      // Check BEFORE normalizing: a near-parallel dir gives a tiny cross
      // product whose normalized direction is numerically unstable.
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
      else side.normalize()
      up.crossVectors(side, dir)

      // Taper: full diameter at the base → 30% at the tip.
      const taper = 1 - 0.7 * (i / FIBER_STEPS)
      const r = (baseDiameters[f]! / 2) * taper
      for (let k = 0; k < TUBE_SIDES; k++) {
        const a = (k / TUBE_SIDES) * Math.PI * 2
        const vi = (vBase + i * TUBE_SIDES + k) * 3
        positions[vi] = p.x + (side.x * Math.cos(a) + up.x * Math.sin(a)) * r
        positions[vi + 1] = p.y + (side.y * Math.cos(a) + up.y * Math.sin(a)) * r
        positions[vi + 2] = p.z + (side.z * Math.cos(a) + up.z * Math.sin(a)) * r
      }
      if (i < ringsPerFiber - 1) {
        for (let k = 0; k < TUBE_SIDES; k++) {
          const k1 = (k + 1) % TUBE_SIDES
          const a = vBase + i * TUBE_SIDES + k
          const b = vBase + i * TUBE_SIDES + k1
          const c = vBase + (i + 1) * TUBE_SIDES + k
          const d = vBase + (i + 1) * TUBE_SIDES + k1
          indices.push(a, b, d, a, d, c)
        }
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Natural lashes for one eye. */
export function buildNaturalLashes(
  line: LashLineSample[],
  anchors: Anchor[],
  natural: NaturalLashes,
): FiberSet {
  const specs: FiberSpec[] = []
  for (const a of anchors) {
    if (a.present > natural.density) continue
    // Natural curl 0..1 maps loosely onto the B..CC range.
    const curl: CurlFamily = natural.curl < 0.33 ? 'B' : natural.curl < 0.7 ? 'C' : 'CC'
    specs.push({
      t: a.t,
      lengthMm: Math.max(3, natural.lengthMm * (1 + 0.25 * a.jitterLen)),
      curl,
      // Natural lashes launch downward-forward; growthDirection 0..1 maps
      // to a pitch of −45° (drooping) … +5° (lifted), −20° at neutral.
      launchPitchRad: (((natural.growthDirection - 0.5) * 50 - 20) * Math.PI) / 180,
      baseDiameterMm: 0.05 + natural.thickness * 0.07,
      fanRad: a.jitterFan * 0.12,
    })
  }
  return buildFiberSet(line, specs)
}

/** Extensions for one eye from the zone design (attach at the same anchors
 *  that carry a natural lash — you can only glue to an existing lash). */
export function buildExtensions(
  line: LashLineSample[],
  anchors: Anchor[],
  natural: NaturalLashes,
  design: LashDesign,
): FiberSet {
  const specs: FiberSpec[] = []
  for (const a of anchors) {
    if (a.present > natural.density) continue
    const zone = zoneAt(design, a.t)
    specs.push({
      t: a.t,
      lengthMm: zone.lengthMm,
      curl: zone.curl,
      // Extensions are glued along the natural lash base, so they inherit
      // the natural launch direction.
      launchPitchRad: (((natural.growthDirection - 0.5) * 50 - 20) * Math.PI) / 180,
      baseDiameterMm: zone.diameterMm * 3, // exaggerated so 0.15mm reads on screen
      fanRad: a.jitterFan * 0.12,
    })
  }
  return buildFiberSet(line, specs)
}

function buildFiberSet(line: LashLineSample[], specs: FiberSpec[]): FiberSet {
  const ringsPerFiber = FIBER_STEPS + 1
  const polylines = new Float32Array(specs.length * ringsPerFiber * 3)
  const anchorT = new Float32Array(specs.length)
  const baseDiameters = new Float32Array(specs.length)

  specs.forEach((spec, f) => {
    const frame = frameAt(line, spec.t)
    writeFiberPolyline(polylines, f * ringsPerFiber * 3, frame, spec)
    anchorT[f] = spec.t
    baseDiameters[f] = spec.baseDiameterMm
  })

  const allIndices = Array.from({ length: specs.length }, (_, i) => i)
  return {
    geometry: buildTubeGeometryFor(polylines, allIndices, baseDiameters),
    polylines,
    fiberCount: specs.length,
    anchorT,
    baseDiameters,
  }
}
