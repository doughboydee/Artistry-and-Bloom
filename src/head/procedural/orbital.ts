import { Vector3 } from 'three'
import type { ResolvedAnatomy } from '../calibration'
import type { Eye } from '../HeadModel'
import { computeEyeFrame, marginPoint, eyeSign } from './margins'
import {
  shellZAt,
  eyeCenterX,
  warpX,
  NEUTRAL_EYE_X,
  EYE_HOLE_RX,
  EYE_HOLE_RY,
  EYE_HOLE_CY,
} from './shell'

/**
 * Orbital patch: the eyelid surface around one eye, from the lid margin
 * (the fissure edge, where lashes grow) out to the orbital rim (where it
 * hands over to the skull shell — the rim ring samples `shellZAt` exactly,
 * so the seam always meets the shell).
 *
 * Polar topology: ring 0 is the closed fissure loop (upper margin from inner
 * to outer corner, then lower margin back), rings 1..RINGS march outward.
 * The radial profile is where the anatomy lives:
 *   - hug the globe sphere out to the crease distance (tarsal lid),
 *   - break at the crease,
 *   - blend outward/backward to the bony rim (deep-set eyes recede here),
 *   - plus the hooding drape displacement above the crease.
 */

export const ORBITAL_SECTORS = 64 // around the fissure (must be even)
export const ORBITAL_RINGS = 12 // radial subdivisions margin → rim
export const ORBITAL_VERTEX_COUNT = ORBITAL_SECTORS * (ORBITAL_RINGS + 1)

const HALF = ORBITAL_SECTORS / 2

/** Fissure loop parameterization: sector index → which lid + curve t. */
export function sectorToLid(i: number): { lid: 'upper' | 'lower'; t: number } {
  if (i <= HALF) return { lid: 'upper', t: i / HALF }
  return { lid: 'lower', t: (ORBITAL_SECTORS - i) / HALF }
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

const rotateAboutAxis = (() => {
  const tmp = new Vector3()
  return (v: Vector3, axis: Vector3, angle: number, out: Vector3): Vector3 => {
    // Rodrigues rotation; axis must be normalized.
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    tmp.crossVectors(axis, v)
    const dot = axis.dot(v)
    out
      .copy(v)
      .multiplyScalar(cos)
      .addScaledVector(tmp, sin)
      .addScaledVector(axis, dot * (1 - cos))
    return out
  }
})()

/**
 * Write the orbital patch vertex positions for one eye into `out` at float
 * offset `base`. Ordering: ring-major, index = ring * SECTORS + sector.
 */
export function writeOrbitalPositions(
  out: Float32Array,
  base: number,
  a: ResolvedAnatomy,
  eye: Eye,
): void {
  const frame = computeEyeFrame(a, eye)
  const G = frame.globeCenter
  const xe = eyeCenterX(a) * eyeSign(eye)
  // Rotation handedness that moves a point on the globe *away* from the eye
  // opening, given the fissure loop's winding (CW for the left eye viewed
  // from the front, CCW for the right).
  const rotSign = eye === 'left' ? -1 : 1

  // Dense fissure loop, then resample uniformly by ANGLE around the eye
  // center. This guarantees the outer rim ring covers the full annulus with
  // no angular gaps (the fissure is star-shaped about the eye center, so the
  // mapping is monotonic).
  const DENSE = 512
  const densePts: Vector3[] = []
  const denseLid: ('upper' | 'lower')[] = []
  const denseT: number[] = []
  const denseAng: number[] = []
  let prevAng = 0
  for (let i = 0; i < DENSE; i++) {
    const { lid, t } = sectorToLid((i / DENSE) * ORBITAL_SECTORS)
    const P = marginPoint(frame, a, lid, t)
    densePts.push(P)
    denseLid.push(lid)
    denseT.push(t)
    let ang = Math.atan2(P.y - G.y, P.x - xe)
    if (i > 0) {
      // Unwrap so the sequence is monotonic around the loop.
      while (ang - prevAng > Math.PI) ang -= 2 * Math.PI
      while (ang - prevAng < -Math.PI) ang += 2 * Math.PI
    }
    denseAng.push(ang)
    prevAng = ang
  }
  const angStart = denseAng[0]!
  const angEnd = denseAng[DENSE - 1]!
  const angSpan = angEnd - angStart // ±2π depending on winding

  const margin: Vector3[] = []
  const marginLid: ('upper' | 'lower')[] = []
  const marginT: number[] = []
  for (let k = 0; k < ORBITAL_SECTORS; k++) {
    const target = angStart + (k / ORBITAL_SECTORS) * angSpan
    let i = 1
    while (
      i < DENSE - 1 &&
      !(Math.min(denseAng[i - 1]!, denseAng[i]!) <= target &&
        target <= Math.max(denseAng[i - 1]!, denseAng[i]!))
    )
      i++
    const seg = denseAng[i]! - denseAng[i - 1]!
    const f = Math.abs(seg) > 1e-9 ? (target - denseAng[i - 1]!) / seg : 0
    margin.push(densePts[i - 1]!.clone().lerp(densePts[i]!, f))
    marginLid.push(denseLid[i - 1]!)
    marginT.push(denseT[i - 1]!)
  }

  const dir0 = new Vector3()
  const axis = new Vector3()
  const hug = new Vector3()
  const p = new Vector3()

  for (let i = 0; i < ORBITAL_SECTORS; i++) {
    const lid = marginLid[i]!
    const t = marginT[i]!
    const M = margin[i]!
    const prev = margin[(i - 1 + ORBITAL_SECTORS) % ORBITAL_SECTORS]!
    const next = margin[(i + 1) % ORBITAL_SECTORS]!
    axis.copy(next).sub(prev).normalize()

    // Rim point: the EXACT ellipse the shell's eye hole is snapped to (in
    // neutral coordinates, then warped the same way the shell is), so the
    // patch boundary and the shell boundary trace the same 3D curve.
    let dx = M.x - xe
    let dy = M.y - EYE_HOLE_CY
    const dLen = Math.hypot(dx, dy)
    if (dLen < 1e-3) {
      dx = 0
      dy = lid === 'upper' ? 1 : -1
    } else {
      dx /= dLen
      dy /= dLen
    }
    const rimR = 1 / Math.sqrt((dx / EYE_HOLE_RX) ** 2 + (dy / EYE_HOLE_RY) ** 2)
    const sign = eyeSign(eye)
    const rimXNeutral = sign * NEUTRAL_EYE_X + dx * rimR
    const rimYNeutral = EYE_HOLE_CY + dy * rimR
    const Wx = warpX(rimXNeutral, rimYNeutral, a)
    const Wy = rimYNeutral
    const W = new Vector3(Wx, Wy, shellZAt(Wx, Wy, a))

    const D = Math.max(1e-3, W.distanceTo(M))
    // Crease depth tapers to the lower-lid value at the corners so adjacent
    // spokes across the canthi agree (no folds).
    const corner = smoothstep(0, 0.18, t) * (1 - smoothstep(0.82, 1, t))
    const creaseD = lid === 'upper' ? 3 + (a.creaseHeightMm - 3) * corner : 3

    dir0.copy(M).sub(G).normalize()

    for (let s = 0; s <= ORBITAL_RINGS; s++) {
      const d = (s / ORBITAL_RINGS) * D

      // Globe-hugging reference (clamped just past the crease so it never
      // wraps around the back of the sphere).
      const hugD = Math.min(d, creaseD + 4)
      rotateAboutAxis(dir0, axis, (rotSign * hugD) / frame.wrapR, hug)
      hug.multiplyScalar(frame.wrapR).add(G)

      if (d <= creaseD) {
        p.copy(hug)
      } else {
        // Crisp departure from the globe at the crease, then DRAPE onto the
        // actual shell surface: XY sweeps out toward the rim while Z blends
        // to shellZAt evaluated at the point itself, so the outer lid
        // carries the true brow ridge / socket shape and meets the shell
        // with no visible seam. A hair of forward lift avoids coplanar
        // z-fighting in the overlap band.
        const beta = Math.min(1, ((d - creaseD) / (D - creaseD)) ** 0.9)
        const px = hug.x + (W.x - hug.x) * beta
        const py = hug.y + (W.y - hug.y) * beta
        // Lift fades to zero at the rim so the patch lands exactly on the
        // shared boundary curve.
        const pz = hug.z + (shellZAt(px, py, a) + 0.15 * (1 - beta) - hug.z) * beta
        p.set(px, py, pz)
      }

      // Hooding drape: skin above the crease pushed down and forward,
      // heaviest over the outer half of the eye.
      if (lid === 'upper' && a.lidHoodingMm > 0 && d > creaseD) {
        const band = Math.exp(-(((d - creaseD - 2) / 3.5) ** 2))
        const lat = 0.3 + 0.7 * smoothstep(0.3, 0.7, t)
        const amp = a.lidHoodingMm * band * lat
        // A real hood overhangs FORWARD past the lash roots as well as
        // drooping down — that forward shelf is what upward-curling
        // extensions collide with.
        p.y -= amp * 0.75
        p.z += amp * 0.9
      }

      // The lid can never pass inside the globe: clamp to the wrap sphere.
      // (Also keeps the collision surface honest — real lids lie ON the eye.)
      const rx2 = p.x - G.x
      const ry2 = p.y - G.y
      const rz2 = p.z - G.z
      const r = Math.hypot(rx2, ry2, rz2)
      if (r < frame.wrapR && r > 1e-6) {
        const f = frame.wrapR / r
        p.set(G.x + rx2 * f, G.y + ry2 * f, G.z + rz2 * f)
      }


      const k = base + (s * ORBITAL_SECTORS + i) * 3
      out[k] = p.x
      out[k + 1] = p.y
      out[k + 2] = p.z
    }
  }
}

/**
 * Fixed index buffer for one orbital patch whose vertices start at
 * `vertexBase`. Winding is chosen per eye so faces point out of the head.
 */
export function buildOrbitalIndices(vertexBase: number, eye: Eye): number[] {
  const indices: number[] = []
  const flip = eye === 'right'
  for (let s = 0; s < ORBITAL_RINGS; s++) {
    for (let i = 0; i < ORBITAL_SECTORS; i++) {
      const i1 = (i + 1) % ORBITAL_SECTORS
      const a = vertexBase + s * ORBITAL_SECTORS + i
      const b = vertexBase + s * ORBITAL_SECTORS + i1
      const c = vertexBase + (s + 1) * ORBITAL_SECTORS + i
      const d = vertexBase + (s + 1) * ORBITAL_SECTORS + i1
      if (flip) indices.push(a, d, b, a, c, d)
      else indices.push(a, b, d, a, d, c)
    }
  }
  return indices
}
