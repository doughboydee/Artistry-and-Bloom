import type { ResolvedAnatomy } from '../calibration'
import { CALIBRATION, resolveAnatomy } from '../calibration'
import { NEUTRAL_PARAMS } from '../HeadModel'

/**
 * Skull/face shell: forehead, temples, brow ridge, cheeks, jaw silhouette.
 *
 * The shell is a height-shaped front "mask" of the head: a rectangular grid
 * mapped onto an elliptical footprint, with Z computed by a closed-form
 * function `shellZAt(x, y)` = ellipsoid front + anatomical displacements
 * (brow ridge, orbital socket dish, cheekbones). Because Z is closed-form,
 * other patches (orbital lids, nose) can evaluate the exact same surface at
 * their border points, which guarantees the seams meet.
 *
 * Topology is fixed: the index buffer is built once, with cells dropped
 * where the orbital patches and the nose take over (the "holes"). Only
 * vertex positions change with parameters.
 */

// Footprint half-extents and vertical center of the face mask, mm.
const HALF_W = 78
const HALF_H = 102
const CENTER_Y = -6
// Ellipsoid depth: front of the shell at eye level sits near z = +14.
const DEPTH_C = 72
const DEPTH_Z0 = -58

// Grid resolution (cols x rows of vertices).
export const SHELL_COLS = 72
export const SHELL_ROWS = 64

// Neutral eye-center distance from midline: holes are carved here and the
// lateral warp recenters vertices when eye spacing changes.
const NEUTRAL = resolveAnatomy(NEUTRAL_PARAMS, CALIBRATION)
export const NEUTRAL_EYE_X = NEUTRAL.eyeSpacingMm / 2 + NEUTRAL.eyeLengthMm / 2

// Orbital hole (in neutral coordinates, around each eye center).
// Centered slightly above the eye center: the upper lid needs more clearance
// (it hugs the globe up to the crease) than the lower. The orbital patch's
// outer rim IS this ellipse (see orbital.ts), so the two meshes share an
// exact boundary curve: shell vertices inside it are snapped onto it.
export const EYE_HOLE_RX = 18
export const EYE_HOLE_RY = 16
export const EYE_HOLE_CY = 2
// Nose hole (neutral coordinates): tapered so it always stays a couple of mm
// inside the nose loft's width at every height.
const NOSE_HOLE_Y_MIN = -26
const NOSE_HOLE_Y_MAX = 2
const noseHoleHalfWidth = (y: number): number =>
  6 + 6 * ((NOSE_HOLE_Y_MAX - y) / (NOSE_HOLE_Y_MAX - NOSE_HOLE_Y_MIN))

/** Current lateral eye-center distance from the midline. */
export const eyeCenterX = (a: ResolvedAnatomy): number =>
  a.eyeSpacingMm / 2 + (a.eyeLengthMm * Math.cos(a.outerCornerTiltRad)) / 2

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** Brow arch centerline height above eye level at lateral offset dxl from the
 *  eye center (negative = toward the nose, positive = toward the temple).
 *  The whole brow complex descends with age as its fat pad shrinks. */
export const browArchY = (dxl: number, a: ResolvedAnatomy): number =>
  21 + 4 * (1 - ((dxl - 5) / 22) ** 2) - a.browDescentMm

/** Lateral envelope of the brow ridge around one eye. */
const browEnvelope = (dxl: number): number =>
  smoothstep(-26, -14, dxl) * (1 - smoothstep(20, 30, dxl))

/**
 * Forward (Z) displacement of the brow ridge at (x, y), both eyes plus a
 * softer glabella (between-the-brows) bridge. Scales with browProjection.
 */
export function browRidgeZ(x: number, y: number, a: ResolvedAnatomy): number {
  const xe = eyeCenterX(a)
  let v = 0
  for (const sign of [1, -1]) {
    const dxl = sign * x - xe
    v += browEnvelope(dxl) * Math.exp(-((y - browArchY(dxl, a)) ** 2) / (2 * 6 * 6))
  }
  const glabella = 0.55 * Math.exp(-(x * x) / (2 * 10 * 10)) * Math.exp(-((y - 20) ** 2) / (2 * 7 * 7))
  return a.browProjectionMm * Math.min(1.05, v + glabella)
}

/** Orbital socket dish: recesses the shell around each eye so the lid patch
 *  layers cleanly in front of it. Deepens as the eyes become deep-set — the
 *  socket hollows along with the globe. */
function socketDish(x: number, y: number, a: ResolvedAnatomy): number {
  const xe = eyeCenterX(a)
  const depth = 2.5 + Math.max(0, -3 - a.globeCenterZMm) * 0.6 + a.socketHollowMm
  let v = 0
  for (const sign of [1, -1]) {
    // Wide, gentle falloff so the recession spreads instead of ringing the
    // socket with a visible curvature band.
    const d2 = ((x - sign * xe) / 17) ** 2 + (y / 14) ** 2
    v += depth * Math.exp(-d2)
  }
  return v
}

/** Cheekbone fullness. */
function cheekZ(x: number, y: number, a: ResolvedAnatomy): number {
  const xe = eyeCenterX(a)
  let v = 0
  for (const sign of [1, -1]) {
    const d2 = ((x - sign * (xe + 6)) / 16) ** 2 + ((y + 30) / 12) ** 2
    v += 2.5 * Math.exp(-d2)
  }
  return v
}

/**
 * The shell surface height at world (x, y). Closed form — evaluated both by
 * the shell grid itself and by neighbouring patches at their borders.
 */
export function shellZAt(x: number, y: number, a: ResolvedAnatomy): number {
  const rho2 = (x / HALF_W) ** 2 + ((y - CENTER_Y) / HALF_H) ** 2
  const base = DEPTH_Z0 + DEPTH_C * Math.sqrt(Math.max(0, 1 - rho2))
  return base + browRidgeZ(x, y, a) - socketDish(x, y, a) + cheekZ(x, y, a)
}

/** Outward normal of the shell surface at (x, y), by central differences. */
export function shellNormalAt(
  x: number,
  y: number,
  a: ResolvedAnatomy,
): { x: number; y: number; z: number } {
  const h = 0.5
  const dzdx = (shellZAt(x + h, y, a) - shellZAt(x - h, y, a)) / (2 * h)
  const dzdy = (shellZAt(x, y + h, a) - shellZAt(x, y - h, a)) / (2 * h)
  const len = Math.hypot(dzdx, dzdy, 1)
  return { x: -dzdx / len, y: -dzdy / len, z: 1 / len }
}

/**
 * Lateral warp: when eye spacing changes, shell vertices near each eye ride
 * along with the eye center so the carved holes keep tracking the orbital
 * patches. Anti-symmetric, so the midline (nose) stays put.
 */
export function warpX(xNeutral: number, yNeutral: number, a: ResolvedAnatomy): number {
  const delta = eyeCenterX(a) - NEUTRAL_EYE_X
  if (Math.abs(delta) < 1e-6) return xNeutral
  let w = 0
  for (const sign of [1, -1]) {
    const d2 = ((xNeutral - sign * NEUTRAL_EYE_X) / 24) ** 2 + (yNeutral / 24) ** 2
    w += sign * Math.exp(-d2)
  }
  return xNeutral + delta * w
}

/** Square-to-disc mapping: grid (u, v) in [-1,1]^2 → unit disc. */
function squareToDisc(u: number, v: number): { x: number; y: number } {
  return {
    x: u * Math.sqrt(1 - (v * v) / 2),
    y: v * Math.sqrt(1 - (u * u) / 2),
  }
}

/** Neutral-space footprint position of grid vertex (i, j). */
export function shellGridXY(i: number, j: number): { x: number; y: number } {
  const u = (i / (SHELL_COLS - 1)) * 2 - 1
  const v = (j / (SHELL_ROWS - 1)) * 2 - 1
  const d = squareToDisc(u, v)
  return { x: d.x * HALF_W, y: CENTER_Y + d.y * HALF_H }
}

/**
 * Eye-hole ellipse half-width for the current anatomy. The neutral hole is
 * sized for the neutral fissure; long + wide-set eyes push the outer corner
 * toward the rim, so the hole grows just enough to always keep ~4mm of lid
 * run beyond the corner. It can only grow (never shrink below the carved
 * topology's hole), so the fixed index buffer stays valid: cells newly
 * swallowed by a larger hole collapse to zero-area slivers on the boundary.
 */
export const eyeHoleRx = (a: ResolvedAnatomy): number =>
  Math.max(EYE_HOLE_RX, eyeCenterX(a) + a.eyeLengthMm / 2 + 4 - NEUTRAL_EYE_X)

/** Squared normalized ellipse distance to a hole (<1 means inside). */
const eyeHoleMetric = (x: number, y: number, sign: number, rx: number): number =>
  ((x - sign * NEUTRAL_EYE_X) / rx) ** 2 + ((y - EYE_HOLE_CY) / EYE_HOLE_RY) ** 2

/** Neutral-hole test — used for the FIXED topology (cell dropping). */
export const insideEyeHole = (x: number, y: number): boolean =>
  eyeHoleMetric(x, y, 1, EYE_HOLE_RX) < 1 || eyeHoleMetric(x, y, -1, EYE_HOLE_RX) < 1

/** Current-hole test — matches where writeShellPositions actually snaps. */
export const insideEyeHoleFor = (x: number, y: number, a: ResolvedAnatomy): boolean => {
  const rx = eyeHoleRx(a)
  return eyeHoleMetric(x, y, 1, rx) < 1 || eyeHoleMetric(x, y, -1, rx) < 1
}

/** Snap a neutral-space point that falls inside a hole onto its boundary. */
function snapToEyeHoleBoundary(x: number, y: number, rx: number): { x: number; y: number } {
  for (const sign of [1, -1]) {
    const e = eyeHoleMetric(x, y, sign, rx)
    if (e < 1) {
      if (e < 1e-9) return { x: sign * NEUTRAL_EYE_X + rx, y: EYE_HOLE_CY }
      const k = 1 / Math.sqrt(e)
      return {
        x: sign * NEUTRAL_EYE_X + (x - sign * NEUTRAL_EYE_X) * k,
        y: EYE_HOLE_CY + (y - EYE_HOLE_CY) * k,
      }
    }
  }
  return { x, y }
}

const insideNoseHole = (x: number, y: number): boolean =>
  y > NOSE_HOLE_Y_MIN && y < NOSE_HOLE_Y_MAX && Math.abs(x) < noseHoleHalfWidth(y)

/**
 * Fixed index buffer for the shell grid, with cells dropped where their
 * center falls in an orbital or nose hole. Vertex ordering: row-major,
 * index = j * SHELL_COLS + i.
 */
export function buildShellIndices(): number[] {
  const indices: number[] = []
  for (let j = 0; j < SHELL_ROWS - 1; j++) {
    for (let i = 0; i < SHELL_COLS - 1; i++) {
      const corners = [
        shellGridXY(i, j),
        shellGridXY(i + 1, j),
        shellGridXY(i, j + 1),
        shellGridXY(i + 1, j + 1),
      ]
      // Cells fully inside an eye hole collapse to slivers after boundary
      // snapping — drop them. Cells that straddle the boundary are kept:
      // their inside corners snap onto the ellipse, giving an exact edge.
      if (corners.every((c) => insideEyeHole(c.x, c.y))) continue
      const cx = (corners[0]!.x + corners[3]!.x) / 2
      const cy = (corners[0]!.y + corners[3]!.y) / 2
      if (insideNoseHole(cx, cy)) continue
      const a = j * SHELL_COLS + i
      const b = j * SHELL_COLS + i + 1
      const c = (j + 1) * SHELL_COLS + i
      const d = (j + 1) * SHELL_COLS + i + 1
      // Counter-clockwise when viewed from +Z (front).
      indices.push(a, b, d, a, d, c)
    }
  }
  return indices
}

export const SHELL_VERTEX_COUNT = SHELL_COLS * SHELL_ROWS

/**
 * Write current shell vertex positions into `out` starting at float offset
 * `base` (3 floats per vertex, row-major grid order).
 */
export function writeShellPositions(out: Float32Array, base: number, a: ResolvedAnatomy): void {
  const rx = eyeHoleRx(a)
  let k = base
  for (let j = 0; j < SHELL_ROWS; j++) {
    for (let i = 0; i < SHELL_COLS; i++) {
      const raw = shellGridXY(i, j)
      const p = snapToEyeHoleBoundary(raw.x, raw.y, rx)
      const x = warpX(p.x, p.y, a)
      out[k++] = x
      out[k++] = p.y
      out[k++] = shellZAt(x, p.y, a)
    }
  }
}
