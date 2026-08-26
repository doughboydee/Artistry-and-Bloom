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

/** Height of the arch centerline at a given x (arch x is monotonic). */
function archYAtX(x: number, arch: { pos: Vector3 }[]): number {
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

/** Crossing of the ray origin→through (extended) with the brow centerline. */
function intersectBrow(
  origin: Vector3,
  through: Vector3,
  arch: { pos: Vector3 }[],
): { browPoint: Vector3; lineEnd: Vector3 } {
  const dir = through.clone().sub(origin)

  // March along the ray from the landmark outward until it rises above the
  // arch centerline height at its own x, then bisect.
  let tLo = 1
  let tHi = 4
  let crossed = false
  for (let t = 1; t <= 4; t += 0.1) {
    const p = origin.clone().addScaledVector(dir, t)
    if (p.y >= archYAtX(p.x, arch)) {
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
      if (p.y >= archYAtX(p.x, arch)) tHi = tm
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

/* ------------------------------------------------------------------ */
/* Mapping METHODS: the industry teaches several construction systems. */

/**
 * - 'classic': angled pencil/string rays from the nostril edge through the
 *   inner corner (start), pupil (arch), outer corner (tail).
 * - 'thread': inked straight lines — a VERTICAL start line at the nostril
 *   wing, a vertical arch line at the outer edge of the iris, the angled
 *   tail ray, plus a horizontal LEVEL line from the start point: a tail
 *   ending below it drags the face down.
 * - 'goldenRatio': start and tail as measured anchors; the arch placed so
 *   start→arch : arch→tail = 1.618 : 1 (the phi proportion calipers check).
 */
export type BrowMappingMethod = 'classic' | 'thread' | 'goldenRatio'

export const BROW_MAPPING_METHODS: { id: BrowMappingMethod; label: string }[] = [
  { id: 'classic', label: 'Classic three-point (pencil rays)' },
  { id: 'thread', label: 'Thread mapping (vertical + level lines)' },
  { id: 'goldenRatio', label: 'Golden ratio (phi calipers)' },
]

export interface VisualLine {
  a: Vector3
  b: Vector3
  style: 'ray' | 'guide' | 'level'
}

export interface SideVisual {
  lines: VisualLine[]
  markers: { kind: 'start' | 'arch' | 'tail'; point: Vector3 }[]
  /** Thread method: tail height minus start height, mm (+ = tail above). */
  levelDeltaMm?: number
  /** Golden-ratio method: measured start→arch : arch→tail ratio. */
  phiRatio?: number
}

const IRIS_RADIUS_MM = 5.5

export function computeMappingVisual(
  method: BrowMappingMethod,
  landmarks: HeadLandmarks,
  regionFor: (eye: Eye) => BrowRegionFn,
): Record<Eye, SideVisual> {
  const classic = computeMappingLines(landmarks, regionFor)
  const result = {} as Record<Eye, SideVisual>

  for (const eye of ['left', 'right'] as Eye[]) {
    const region = regionFor(eye)
    const arch: { pos: Vector3 }[] = []
    for (let i = 0; i <= ARCH_SAMPLES; i++) {
      arch.push({ pos: region(i / ARCH_SAMPLES, 0.5).position })
    }
    const sign = eye === 'left' ? 1 : -1
    const nostril = landmarks.nostrilOuter[eye]

    // A point on the brow centerline directly above x, plus the vertical
    // guide line up to it from the nostril's height.
    const verticalTo = (x: number): { point: Vector3; line: VisualLine } => {
      const point = new Vector3(x, archYAtX(x, arch), browZAtX(x, arch))
      return {
        point,
        line: {
          a: new Vector3(x, nostril.y, point.z),
          b: new Vector3(x, point.y + 8, point.z),
          style: 'guide',
        },
      }
    }
    const rayLine = (l: MappingLine): VisualLine => ({
      a: l.origin.clone().add(new Vector3(0, 0, 1)),
      b: l.lineEnd.clone().add(new Vector3(0, 0, 1)),
      style: 'ray',
    })

    if (method === 'classic') {
      result[eye] = {
        lines: [rayLine(classic[eye].start), rayLine(classic[eye].arch), rayLine(classic[eye].tail)],
        markers: [
          { kind: 'start', point: classic[eye].start.browPoint },
          { kind: 'arch', point: classic[eye].arch.browPoint },
          { kind: 'tail', point: classic[eye].tail.browPoint },
        ],
      }
    } else if (method === 'thread') {
      const start = verticalTo(nostril.x)
      const irisOuterX = landmarks.pupil[eye].x + sign * IRIS_RADIUS_MM
      const archV = verticalTo(irisOuterX)
      const tail = classic[eye].tail
      const levelDeltaMm = tail.browPoint.y - start.point.y
      // The level line runs horizontally from the start point out past the tail.
      const levelEndX = tail.browPoint.x + sign * 6
      const level: VisualLine = {
        a: new Vector3(start.point.x, start.point.y, start.point.z),
        b: new Vector3(levelEndX, start.point.y, browZAtX(levelEndX, arch)),
        style: 'level',
      }
      result[eye] = {
        lines: [start.line, archV.line, rayLine(tail), level],
        markers: [
          { kind: 'start', point: start.point },
          { kind: 'arch', point: archV.point },
          { kind: 'tail', point: tail.browPoint },
        ],
        levelDeltaMm,
      }
    } else {
      // goldenRatio: anchors from measurement, arch at the phi division.
      const start = verticalTo(nostril.x)
      const tail = classic[eye].tail
      const PHI = 1.618
      const archX = start.point.x + (tail.browPoint.x - start.point.x) * (PHI / (1 + PHI))
      const archV = verticalTo(archX)
      const spanStart = Math.abs(archV.point.x - start.point.x)
      const spanTail = Math.abs(tail.browPoint.x - archV.point.x)
      const measure: VisualLine = {
        a: start.point.clone(),
        b: tail.browPoint.clone(),
        style: 'level',
      }
      result[eye] = {
        lines: [start.line, archV.line, rayLine(tail), measure],
        markers: [
          { kind: 'start', point: start.point },
          { kind: 'arch', point: archV.point },
          { kind: 'tail', point: tail.browPoint },
        ],
        phiRatio: spanTail > 1e-6 ? spanStart / spanTail : 0,
      }
    }
  }
  return result
}

/** Left/right height differences of matching markers, in mm (left − right). */
export function symmetryDeltas(
  visual: Record<Eye, SideVisual>,
): Record<'start' | 'arch' | 'tail', number> {
  const get = (eye: Eye, kind: 'start' | 'arch' | 'tail') =>
    visual[eye].markers.find((m) => m.kind === kind)!.point.y
  return {
    start: get('left', 'start') - get('right', 'start'),
    arch: get('left', 'arch') - get('right', 'arch'),
    tail: get('left', 'tail') - get('right', 'tail'),
  }
}
