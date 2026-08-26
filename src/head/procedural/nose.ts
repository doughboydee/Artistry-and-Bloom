import { Vector3 } from 'three'
import type { ResolvedAnatomy } from '../calibration'
import { shellZAt } from './shell'

/**
 * Nose loft: cross-sections from the nasion (between the brows) down to the
 * base, widening to the alar (nostril) width. The flank edges of every
 * section land exactly on the shell surface (`shellZAt`), so the nose blends
 * into the face. `noseBaseWidth` scales the lower stations — which moves the
 * nostril-outer landmarks the brow-mapping lines are measured from.
 */

export const NOSE_STATIONS = 12 // rows, top → bottom
export const NOSE_PROFILE = 15 // columns, left flank → right flank
export const NOSE_VERTEX_COUNT = NOSE_STATIONS * NOSE_PROFILE

const Y_TOP = 6
const Y_BASE = -30
const TIP_Z = 26

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** Station half-width at fraction s (0 top → 1 base). */
function halfWidth(s: number, a: ResolvedAnatomy): number {
  const alarHalf = a.noseBaseWidthMm / 2
  return 9 + (alarHalf - 9) * smoothstep(0.45, 0.9, s)
}

/** Ridge (center line) height at fraction s. */
function ridgeZ(s: number, a: ResolvedAnatomy): number {
  const zStart = shellZAt(0, Y_TOP, a)
  if (s <= 0.85) return zStart + (TIP_Z - zStart) * (s / 0.85) ** 1.2
  return TIP_Z - ((s - 0.85) / 0.15) * 4
}

export function writeNosePositions(out: Float32Array, base: number, a: ResolvedAnatomy): void {
  let k = base
  for (let j = 0; j < NOSE_STATIONS; j++) {
    const s = j / (NOSE_STATIONS - 1)
    const y = Y_TOP + (Y_BASE - Y_TOP) * s
    const w = halfWidth(s, a)
    const zr = ridgeZ(s, a)
    for (let i = 0; i < NOSE_PROFILE; i++) {
      const q = (i / (NOSE_PROFILE - 1)) * 2 - 1 // -1 left flank → +1 right
      const x = q * w
      const flankZ = shellZAt(x, y, a)
      const blend = Math.cos((q * Math.PI) / 2) ** 1.6
      out[k++] = x
      out[k++] = y
      out[k++] = flankZ + Math.max(0, zr - flankZ) * blend
    }
  }
}

export function buildNoseIndices(vertexBase: number): number[] {
  const indices: number[] = []
  for (let j = 0; j < NOSE_STATIONS - 1; j++) {
    for (let i = 0; i < NOSE_PROFILE - 1; i++) {
      const a = vertexBase + j * NOSE_PROFILE + i
      const b = vertexBase + j * NOSE_PROFILE + i + 1
      const c = vertexBase + (j + 1) * NOSE_PROFILE + i
      const d = vertexBase + (j + 1) * NOSE_PROFILE + i + 1
      // Rows run top→bottom, so wind for front (+Z) facing.
      indices.push(a, d, b, a, c, d)
    }
  }
  return indices
}

/** Outer edge of each nostril wing: origin of the brow-mapping lines. */
export function nostrilOuterLandmarks(a: ResolvedAnatomy): { left: Vector3; right: Vector3 } {
  const y = -27
  const s = (Y_TOP - y) / (Y_TOP - Y_BASE)
  const x = halfWidth(s, a) - 0.5
  const z = shellZAt(x, y, a) + 2
  return {
    left: new Vector3(x, y, z),
    right: new Vector3(-x, y, z),
  }
}
