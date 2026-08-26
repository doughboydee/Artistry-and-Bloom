import { Vector3 } from 'three'
import type { ResolvedAnatomy } from '../calibration'
import type { Eye, LashLineSample } from '../HeadModel'

/**
 * Lid margin (palpebral fissure) math. Everything here is analytic so the
 * lash line, the orbital lid surface and the landmarks all derive from the
 * exact same curves and can never drift apart as parameters change.
 *
 * Frame: head space, mm. +X = subject's left, +Y up, +Z out of the face.
 * The fissure is laid out in the XY plane and then wrapped onto the front of
 * the globe sphere to get true corner recession in Z.
 */

/** +1 for the subject's left eye (on +X), -1 for the right. */
export const eyeSign = (eye: Eye): number => (eye === 'left' ? 1 : -1)

export interface EyeFrame {
  /** Inner canthus, XY plane (Z comes from the globe wrap). */
  innerXY: { x: number; y: number }
  /** Outer canthus, XY plane. */
  outerXY: { x: number; y: number }
  /** Globe (eyeball) center in 3D. */
  globeCenter: Vector3
  /** Globe radius, mm. */
  globeR: number
  /** Radius of the sphere the lid margin wraps on (globe + lid thickness). */
  wrapR: number
}

/** Canthi and globe placement for one eye. */
export function computeEyeFrame(a: ResolvedAnatomy, eye: Eye): EyeFrame {
  const sign = eyeSign(eye)
  const tilt = a.outerCornerTiltRad
  const L = a.eyeLengthMm
  const ix = sign * (a.eyeSpacingMm / 2)
  const innerXY = { x: ix, y: 0 }
  const outerXY = { x: ix + sign * L * Math.cos(tilt), y: L * Math.sin(tilt) }
  const globeCenter = new Vector3(
    (innerXY.x + outerXY.x) / 2,
    (innerXY.y + outerXY.y) / 2,
    a.globeCenterZMm,
  )
  return {
    innerXY,
    outerXY,
    globeCenter,
    globeR: a.globeRadiusMm,
    wrapR: a.globeRadiusMm + a.lidThicknessMm,
  }
}

/** Cubic Bézier through 2D points. */
function bezier2(
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return {
    x: w0 * p0.x + w1 * c1.x + w2 * c2.x + w3 * p3.x,
    y: w0 * p0.y + w1 * c1.y + w2 * c2.y + w3 * p3.y,
  }
}

/**
 * Upper or lower lid margin in the XY plane, t: 0 inner corner → 1 outer.
 * Upper margin peaks nasal of center (~40% out), lower troughs temporal
 * (~60% out) — the real fissure shape.
 */
export function marginXY(
  frame: EyeFrame,
  a: ResolvedAnatomy,
  lid: 'upper' | 'lower',
  t: number,
): { x: number; y: number } {
  const { innerXY: I, outerXY: O } = frame
  const chord = { x: O.x - I.x, y: O.y - I.y }
  // Perpendicular to the chord, pointing up for the upper lid.
  const len = Math.hypot(chord.x, chord.y)
  const perp = { x: -chord.y / len, y: chord.x / len }
  const up = perp.y >= 0 ? perp : { x: -perp.x, y: -perp.y }
  const amp = lid === 'upper' ? 0.55 * a.eyeOpeningMm : -0.45 * a.eyeOpeningMm
  const peakT = lid === 'upper' ? 0.4 : 0.6
  // Control points placed to put the extremum near peakT with amplitude amp
  // (cubic Bézier maxes at ~0.75 of control height with these tangents).
  const lift = amp / 0.75
  const c1 = {
    x: I.x + chord.x * (peakT * 0.66),
    y: I.y + chord.y * (peakT * 0.66) + up.y * lift,
  }
  const c2 = {
    x: I.x + chord.x * (peakT + (1 - peakT) * 0.34),
    y: I.y + chord.y * (peakT + (1 - peakT) * 0.34) + up.y * lift,
  }
  return bezier2(I, c1, c2, O, t)
}

/**
 * Wrap an XY point onto the front of the margin sphere (globe + lid).
 * Points slightly outside the sphere's silhouette (the canthi) clamp to a
 * minimum forward offset so the corners still sit just in front of the globe
 * equator instead of exploding.
 */
export function wrapOnGlobe(frame: EyeFrame, x: number, y: number): Vector3 {
  const g = frame.globeCenter
  const d2 = (x - g.x) ** 2 + (y - g.y) ** 2
  const r2 = frame.wrapR ** 2
  const MIN_FORWARD = 1.0
  const zOff = Math.sqrt(Math.max(r2 - d2, MIN_FORWARD * MIN_FORWARD))
  return new Vector3(x, y, g.z + zOff)
}

/** 3D margin point. */
export function marginPoint(
  frame: EyeFrame,
  a: ResolvedAnatomy,
  lid: 'upper' | 'lower',
  t: number,
): Vector3 {
  const p = marginXY(frame, a, lid, t)
  return wrapOnGlobe(frame, p.x, p.y)
}

/**
 * Arc-length-uniform lash line samples along the upper margin with full
 * frames. `growthAngleRad` pitches the natural emergence direction away from
 * the pure surface normal toward "up and out over the lid edge".
 */
export function sampleLashLine(
  frame: EyeFrame,
  a: ResolvedAnatomy,
  eye: Eye,
  count: number,
  growthAngleRad = (25 * Math.PI) / 180,
): LashLineSample[] {
  // Dense pass for arc-length parameterization.
  const DENSE = 128
  const dense: Vector3[] = []
  for (let i = 0; i <= DENSE; i++) {
    dense.push(marginPoint(frame, a, 'upper', i / DENSE))
  }
  const cum: number[] = [0]
  for (let i = 1; i <= DENSE; i++) {
    cum.push(cum[i - 1]! + dense[i]!.distanceTo(dense[i - 1]!))
  }
  const total = cum[DENSE]!

  const samples: LashLineSample[] = []
  const sign = eyeSign(eye)
  for (let k = 0; k < count; k++) {
    const target = (k / (count - 1)) * total
    // Locate the dense segment containing this arc length.
    let i = 1
    while (i < DENSE && cum[i]! < target) i++
    const seg = cum[i]! - cum[i - 1]!
    const f = seg > 0 ? (target - cum[i - 1]!) / seg : 0
    const position = dense[i - 1]!.clone().lerp(dense[i]!, f)

    const tangent = dense[Math.min(i, DENSE)]!
      .clone()
      .sub(dense[Math.max(i - 1, 0)]!)
      .normalize()
    const surfaceNormal = position.clone().sub(frame.globeCenter).normalize()
    // In-surface direction away from the eye opening (up over the lid edge):
    // perpendicular to the tangent, within the tangent plane of the sphere.
    const away = new Vector3().crossVectors(tangent, surfaceNormal)
    // Orient so it points upward (+Y); flips between eyes since the tangent
    // runs inner→outer on both sides.
    if (away.y < 0) away.negate()
    const growthDir = surfaceNormal
      .clone()
      .multiplyScalar(Math.cos(growthAngleRad))
      .addScaledVector(away, Math.sin(growthAngleRad))
      .normalize()

    samples.push({
      t: k / (count - 1),
      position,
      tangent: sign > 0 ? tangent : tangent.clone(),
      surfaceNormal,
      growthDir,
    })
  }
  return samples
}
