import { Vector3 } from 'three'
import type { BrowRegionSample, Eye } from '../head/HeadModel'
import { curlPolyline } from '../lashes/curlProfiles'
import { buildTubeGeometryFor, FIBER_STEPS, type FiberSet } from '../lashes/fiberGeometry'
import {
  browBandWidthMm,
  browHairCount,
  browHairDiameterMm,
  browVerticalOffsetMm,
  type BrowParams,
} from './browDesign'

/**
 * Procedural brow hairs over the brow band supplied by the head
 * (`getBrowRegion`). Hairs follow the classic growth pattern: near the head
 * of the brow they point steeply upward, through the body they sweep
 * up-and-outward, and at the tail they lie nearly flat pointing outward and
 * slightly down. `growthDirection` biases the whole field flatter or
 * steeper.
 */

type BrowRegionFn = (u: number, v: number) => BrowRegionSample

const RINGS = FIBER_STEPS + 1

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

export function buildBrowHairs(region: BrowRegionFn, eye: Eye, params: BrowParams): FiberSet {
  const rng = makeRng(eye === 'left' ? 24601 : 10642)
  const count = browHairCount(params.density)
  const bandWidth = browBandWidthMm(params.fullness)
  const vShift = browVerticalOffsetMm(params.verticalOffset)

  const polylines = new Float32Array(count * RINGS * 3)
  const anchorT = new Float32Array(count)
  const baseDiameters = new Float32Array(count)

  const du = new Vector3()
  const heading = new Vector3()
  const lift = new Vector3()

  for (let f = 0; f < count; f++) {
    const u = Math.min(0.995, Math.max(0.005, rng() ** 0.85))
    // Center-weighted across the band; the band thins toward the tail.
    const taper = 1 - 0.55 * u
    const vSpread = (rng() + rng() - 1) * 0.5 // triangular, -0.5..0.5
    const localBand = bandWidth * taper
    // getBrowRegion's v spans a fixed 16mm band; convert our mm offsets.
    const vMm = vSpread * localBand + vShift
    const v = 0.5 + vMm / 16

    const base = region(u, v)
    const ahead = region(Math.min(1, u + 0.02), v)
    du.copy(ahead.position).sub(base.position).normalize() // along arch, toward tail

    // Surface-plane "up": perpendicular to the arch direction.
    const n = base.normal
    lift.copy(n)
    heading.crossVectors(n, du) // roughly vertical in the surface plane
    if (heading.y < 0) heading.negate()

    // Growth angle from vertical toward lateral, by position along the brow
    // plus the global growthDirection bias.
    const steepness = 0.75 - 0.85 * u + (params.growthDirection - 0.5) * 0.5
    const angleFromUp = (1 - Math.min(1, Math.max(0, steepness))) * (Math.PI / 2) * 1.15
    const dir = heading
      .clone()
      .multiplyScalar(Math.cos(angleFromUp))
      .addScaledVector(du, Math.sin(angleFromUp))
      .normalize()

    const lengthMm = (7 - 2.5 * u) * (1 + 0.2 * (rng() * 2 - 1))
    const pts2d = curlPolyline('B', lengthMm, FIBER_STEPS)
    const o = f * RINGS * 3
    for (let i = 0; i < RINGS; i++) {
      const p2 = pts2d[i]!
      // Slight bow off the skin (lift is the surface normal, scaled down so
      // the hair hugs the surface).
      const lx = p2.y * 0.35
      polylines[o + i * 3] = base.position.x + dir.x * p2.x + lift.x * lx + n.x * 0.15
      polylines[o + i * 3 + 1] = base.position.y + dir.y * p2.x + lift.y * lx + n.y * 0.15
      polylines[o + i * 3 + 2] = base.position.z + dir.z * p2.x + lift.z * lx + n.z * 0.15
    }
    anchorT[f] = u
    baseDiameters[f] = browHairDiameterMm(params.caliber) * 3 // render-exaggerated like lashes
  }

  const allIndices = Array.from({ length: count }, (_, i) => i)
  return {
    geometry: buildTubeGeometryFor(polylines, allIndices, baseDiameters),
    polylines,
    fiberCount: count,
    anchorT,
    baseDiameters,
  }
}
