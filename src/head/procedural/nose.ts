import { Vector3 } from 'three'
import type { ResolvedAnatomy } from '../calibration'
import { shellZAt } from './shell'

/**
 * Nose loft: cross-sections from the nasion (between the brows) down the
 * dorsum to the tip, then curling back UNDER the tip to the upper lip so the
 * base is a closed, rounded surface rather than an open cut. The flank edges
 * of every section land exactly on the shell surface (`shellZAt`), so the
 * nose blends into the face. `noseBaseWidth` scales the lower stations —
 * which moves the nostril-outer landmarks the brow-mapping lines are
 * measured from.
 */

export const NOSE_STATIONS = 34 // rows, nasion → tip → subnasale
export const NOSE_PROFILE = 29 // columns, left flank → right flank
export const NOSE_VERTEX_COUNT = NOSE_STATIONS * NOSE_PROFILE

const Y_TOP = 6
const Y_BASE = -30
const TIP_Z = 26
/** Fraction of the stations spent on the dorsum; the rest curl underneath. */
const DORSUM_FRACTION = 0.7
/** How far below the base the underside tucks in to meet the lip, mm. */
const UNDER_DROP = 4.6

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
  if (s <= 0.82) return zStart + (TIP_Z - zStart) * (s / 0.82) ** 1.2
  // Rounded tip: ease over the top, then fall away toward the base so the
  // underside (and the nostrils) tilt forward into view, as on a real nose.
  const k = (s - 0.82) / 0.18
  return TIP_Z - 6.5 * k * k
}

/** Row j → dorsum fraction s (0..1) and underside fraction v (0..1). */
function stationOf(j: number): { s: number; v: number } {
  const u = j / (NOSE_STATIONS - 1)
  if (u <= DORSUM_FRACTION) return { s: u / DORSUM_FRACTION, v: 0 }
  return { s: 1, v: (u - DORSUM_FRACTION) / (1 - DORSUM_FRACTION) }
}

/**
 * Cross-section shape, 0 at the flanks → ~1 on the ridge. Narrow and
 * ridge-like along the bony bridge, rounder through the tip, with the alar
 * lobes (nostril wings) swelling out low on either side.
 */
function sectionShape(q: number, s: number): number {
  const c = Math.cos((q * Math.PI) / 2)
  const tipness = smoothstep(0.55, 0.95, s)
  const ridge = c ** (1.7 - 0.75 * tipness)
  const lobe =
    0.34 * tipness * Math.exp(-(((Math.abs(q) - 0.66) / 0.2) ** 2)) * Math.sqrt(Math.max(0, c))
  return ridge + lobe
}

export function writeNosePositions(out: Float32Array, base: number, a: ResolvedAnatomy): void {
  let k = base
  for (let j = 0; j < NOSE_STATIONS; j++) {
    const { s, v } = stationOf(j)
    const yRow = Y_TOP + (Y_BASE - Y_TOP) * s
    const w = halfWidth(s, a) * (1 - 0.12 * v)
    const zr = ridgeZ(s, a)
    // Underside: the whole section sinks back onto the lip.
    for (let i = 0; i < NOSE_PROFILE; i++) {
      const q = (i / (NOSE_PROFILE - 1)) * 2 - 1 // -1 left flank → +1 right
      const x = q * w
      const mid = Math.cos((q * Math.PI) / 2)
      // The columella (centre) hangs lower than the wings, and the wings
      // tuck back onto the cheek sooner than the centre does.
      const y = yRow - UNDER_DROP * v * (0.5 + 0.5 * mid)
      const under = 1 - smoothstep(0, 1, v * (1.35 - 0.35 * mid))
      const flankZ = shellZAt(x, y, a)
      out[k++] = x
      out[k++] = y
      out[k++] = flankZ + Math.max(0, zr - flankZ) * sectionShape(q, s) * under
    }
  }
}

/**
 * Per-vertex shading helpers for the nose (same vertex order as positions):
 * `edge` is 1 on the rows/columns that sit on the shell (their normals are
 * welded to the shell's so no seam shows), and `nostril` is the 0..1 depth
 * of the painted nostril openings on the underside.
 */
export function noseVertexInfo(j: number, i: number): { edge: number; nostril: number } {
  const { s, v } = stationOf(j)
  const q = (i / (NOSE_PROFILE - 1)) * 2 - 1
  const colEdge = Math.min(i, NOSE_PROFILE - 1 - i)
  const rowEdge = Math.min(j, NOSE_STATIONS - 1 - j)
  const d = Math.min(colEdge, rowEdge)
  const edge = d === 0 ? 1 : d === 1 ? 0.5 : 0
  const nostril =
    s >= 1
      ? Math.exp(-(((Math.abs(q) - 0.4) / 0.17) ** 2) - ((v - 0.36) / 0.24) ** 2)
      : 0
  return { edge, nostril }
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
