import { Vector3 } from 'three'
import type { BrowRegionSample, Eye, HeadLandmarks } from '../head/HeadModel'

/**
 * The three brow-mapping lines students are taught, computed live from the
 * current anatomy:
 *   START — from the outer nostril edge up through the INNER eye corner
 *   ARCH  — from the nostril through the PUPIL center
 *   TAIL  — from the nostril through the OUTER eye corner
 * Where each line crosses the brow is where the brow should begin, peak,
 * and end. Because the landmarks move with nose width, eye spacing, eye
 * length, and corner tilt, changing those sliders visibly moves the points
 * — that is the lesson.
 */

type BrowRegionFn = (u: number, v: number) => BrowRegionSample

export interface MappingLine {
  /** Nostril-edge origin of the string. */
  origin: Vector3
  /** The landmark the string passes through (eye corner or pupil). */
  through: Vector3
  /** Where the string crosses the brow band. */
  browPoint: Vector3
  /** Line end drawn a little past the brow for readability. */
  lineEnd: Vector3
}

export interface SideMapping {
  start: MappingLine
  arch: MappingLine
  tail: MappingLine
}

const ARCH_SAMPLES = 24

/** Crossing of the ray origin→through (extended) with the brow centerline. */
function intersectBrow(
  origin: Vector3,
  through: Vector3,
  arch: { pos: Vector3 }[],
): { browPoint: Vector3; lineEnd: Vector3 } {
  const dir = through.clone().sub(origin)

  // Height of the arch centerline at a given x (arch x is monotonic).
  const archYAtX = (x: number): number => {
    const first = arch[0]!.pos
    const last = arch[arch.length - 1]!.pos
    const ascending = last.x > first.x
    let lo = arch[0]!
    let hi = arch[arch.length - 1]!
    for (let i = 0; i < arch.length - 1; i++) {
      const a = arch[i]!
      const b = arch[i + 1]!
      const inSeg = ascending ? x >= a.pos.x && x <= b.pos.x : x <= a.pos.x && x >= b.pos.x
      if (inSeg) {
        lo = a
        hi = b
        break
      }
    }
    const span = hi.pos.x - lo.pos.x
    const f = Math.abs(span) > 1e-6 ? (x - lo.pos.x) / span : 0
    return lo.pos.y + (hi.pos.y - lo.pos.y) * Math.min(1, Math.max(0, f))
  }

  // March along the ray from the landmark outward until it rises above the
  // arch centerline height at its own x, then bisect.
  let tLo = 1
  let tHi = 4
  let crossed = false
  for (let t = 1; t <= 4; t += 0.1) {
    const p = origin.clone().addScaledVector(dir, t)
    if (p.y >= archYAtX(p.x)) {
      tHi = t
      crossed = true
      break
    }
    tLo = t
  }
  if (crossed) {
    for (let i = 0; i < 20; i++) {
      const tm = (tLo + tHi) / 2
      const p = origin.clone().addScaledVector(dir, tm)
      if (p.y >= archYAtX(p.x)) tHi = tm
      else tLo = tm
    }
  }
  const tCross = crossed ? (tLo + tHi) / 2 : 4
  const browPoint = origin.clone().addScaledVector(dir, tCross)
  // Pull the marker to the arch's Z so it sits on the skin, not behind it.
  browPoint.z = Math.max(browPoint.z, browZAtX(browPoint.x, arch))
  const lineEnd = origin.clone().addScaledVector(dir, tCross + 8 / dir.length())
  return { browPoint, lineEnd }
}

function browZAtX(x: number, arch: { pos: Vector3 }[]): number {
  let best = arch[0]!.pos
  let bestD = Infinity
  for (const a of arch) {
    const d = Math.abs(a.pos.x - x)
    if (d < bestD) {
      bestD = d
      best = a.pos
    }
  }
  return best.z + 0.5
}

export function computeMappingLines(
  landmarks: HeadLandmarks,
  regionFor: (eye: Eye) => BrowRegionFn,
): Record<Eye, SideMapping> {
  const result = {} as Record<Eye, SideMapping>
  for (const eye of ['left', 'right'] as Eye[]) {
    const region = regionFor(eye)
    const arch: { pos: Vector3 }[] = []
    for (let i = 0; i <= ARCH_SAMPLES; i++) {
      arch.push({ pos: region(i / ARCH_SAMPLES, 0.5).position })
    }
    const origin = landmarks.nostrilOuter[eye]
    const mk = (through: Vector3): MappingLine => ({
      origin: origin.clone(),
      through: through.clone(),
      ...intersectBrow(origin, through, arch),
    })
    result[eye] = {
      start: mk(landmarks.innerCanthus[eye]),
      arch: mk(landmarks.pupil[eye]),
      tail: mk(landmarks.outerCanthus[eye]),
    }
  }
  return result
}
